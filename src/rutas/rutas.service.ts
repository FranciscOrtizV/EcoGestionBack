import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
import { validate as isUuid } from 'uuid';
import {
  AsignacionRuta,
  AuditoriaLog,
  EjecucionRuta,
  PuntoRecoleccion,
  PuntoRuta,
  Ruta,
  Usuario,
} from 'src/common/entities';
import { AccionAuditoriaEnum, EntidadesEnum, RolesValidosEnum } from 'src/common/enums';
import { buildResponse } from 'src/common/helpers';
import { CreateRutaDto } from './dto/create-ruta.dto';
import { PuntoRutaLineaDto } from './dto/punto-ruta-linea.dto';
import { UpdateRutaDto } from './dto/update-ruta.dto';

/** Ruta con puntos cargados por consulta (evita ciclo Ruta ↔ PuntoRuta en metadatos). */
type RutaConPuntos = Ruta & { puntosRuta: PuntoRuta[] };

const REL_PUNTO_RUTA_DETALLE = [
  'puntoRecoleccion',
  'puntoRecoleccion.zona',
] as const;

@Injectable()
export class RutasService {
  constructor(
    @InjectRepository(Ruta)
    private readonly rutaRepository: Repository<Ruta>,

    @InjectRepository(PuntoRuta)
    private readonly puntoRutaRepository: Repository<PuntoRuta>,

    @InjectRepository(PuntoRecoleccion)
    private readonly puntoRecoleccionRepository: Repository<PuntoRecoleccion>,

    @InjectRepository(AuditoriaLog)
    private readonly auditoriaLogRepository: Repository<AuditoriaLog>,

    @InjectRepository(AsignacionRuta)
    private readonly asignacionRutaRepository: Repository<AsignacionRuta>,

    @InjectRepository(EjecucionRuta)
    private readonly ejecucionRutaRepository: Repository<EjecucionRuta>,

    private readonly dataSource: DataSource,
  ) {}

  async create(createDto: CreateRutaDto, user: Usuario) {
    const nombre = createDto.nombre.trim();

    if (!nombre)
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'El nombre de la ruta no puede estar vacío.',
      );

    const existenteNombre = await this.rutaRepository.findOneBy({ nombre });

    if (existenteNombre)
      return buildResponse(
        HttpStatus.CONFLICT,
        `Ya existe una ruta con el nombre: ${nombre}.`,
      );

    const codigoTrim = createDto.codigo?.trim();
    const codigoFinal = codigoTrim?.length ? codigoTrim : undefined;

    if (codigoFinal) {
      const existenteCodigo = await this.rutaRepository.findOneBy({
        codigo: codigoFinal,
      });

      if (existenteCodigo)
        return buildResponse(
          HttpStatus.CONFLICT,
          `Ya existe una ruta con el código: ${codigoFinal}.`,
        );
    }

    const descripcion = createDto.descripcion?.trim();
    const tipoRuta = createDto.tipoRuta?.trim();

    if (createDto.puntos?.length) {
      const validacion = this.validarLineasPuntos(createDto.puntos);

      if (!validacion.ok)
        return buildResponse(validacion.status, validacion.message);

      const errPuntos = await this.validarPuntosRecoleccionActivos(
        createDto.puntos,
      );

      if (errPuntos) return errPuntos;
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const nuevaRuta = this.rutaRepository.create({
        nombre,
        codigo: codigoFinal,
        descripcion: descripcion || undefined,
        tipoRuta: tipoRuta?.length ? tipoRuta : undefined,
        estimacionDuracionMinutos: createDto.estimacionDuracionMinutos,
      });

      await queryRunner.manager.save(nuevaRuta);

      if (createDto.puntos?.length)
        await this.reemplazarPuntosRuta(
          queryRunner,
          nuevaRuta.id,
          createDto.puntos,
        );

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.RUTAS,
        accion: AccionAuditoriaEnum.CREATE,
        valorNuevo: await this.obtenerRutaPlanaParaAuditoria(
          queryRunner,
          nuevaRuta.id,
        ),
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      const creada = await this.cargarRutaCompleta(nuevaRuta.id);

      return buildResponse(
        HttpStatus.CREATED,
        'Ruta creada correctamente',
        creada,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async findAll(incluirInactivos = false, conPuntos = true) {
    const rutas = await this.rutaRepository.find({
      where: incluirInactivos ? {} : { isActive: true },
      order: { nombre: 'ASC' },
    });

    const resultado = conPuntos
      ? await Promise.all(rutas.map((r) => this.adjuntarPuntosARuta(r)))
      : rutas;

    return buildResponse(
      HttpStatus.OK,
      'Listado de rutas obtenido correctamente',
      resultado,
    );
  }

  async findRutasAsignadas(
    query: {
      conductorId?: string;
      planificadorId?: string;
      supervisorId?: string;
    },
    solicitante: Usuario,
  ) {
    const conductorId = query.conductorId?.trim() || undefined;
    const planificadorId = query.planificadorId?.trim() || undefined;
    const supervisorId = query.supervisorId?.trim() || undefined;

    const indicados = [conductorId, planificadorId, supervisorId].filter(
      Boolean,
    ) as string[];

    if (indicados.length !== 1)
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'Debe indicar exactamente uno de: conductorId, planificadorId o supervisorId.',
      );

    const id = indicados[0];

    if (!isUuid(id))
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'El identificador indicado debe ser un UUID válido.',
      );

    if (conductorId) {
      this.assertPuedeConsultarRutasAsignadas(solicitante, 'conductor', id);
    } else if (planificadorId) {
      this.assertPuedeConsultarRutasAsignadas(solicitante, 'planificador', id);
    } else {
      this.assertPuedeConsultarRutasAsignadas(solicitante, 'supervisor', id);
    }

    const qb = this.ejecucionRutaRepository
      .createQueryBuilder('ej')
      .innerJoinAndSelect('ej.asignacionRuta', 'asig')
      .innerJoinAndSelect('asig.ruta', 'ruta')
      .innerJoinAndSelect('asig.vehiculo', 'veh')
      .orderBy('asig.fechaAsignacion', 'DESC')
      .addOrderBy('asig.turno', 'ASC');

    if (conductorId) {
      qb.innerJoin('asig.conductor', 'filtroUsuario').where(
        'filtroUsuario.id = :usuarioFiltroId',
        { usuarioFiltroId: id },
      );
    } else if (planificadorId) {
      qb.innerJoin('asig.planificador', 'filtroUsuario').where(
        'filtroUsuario.id = :usuarioFiltroId',
        { usuarioFiltroId: id },
      );
    } else {
      qb.innerJoin('asig.supervisor', 'filtroUsuario').where(
        'filtroUsuario.id = :usuarioFiltroId',
        { usuarioFiltroId: id },
      );
    }

    const ejecuciones = await qb.getMany();

    const items = ejecuciones.map((ej) => {
      const asig = ej.asignacionRuta;
      const ruta = asig.ruta;
      const veh = asig.vehiculo;

      return {
        ejecucionRutaId: ej.id,
        nombre: ruta.nombre,
        codigo: ruta.codigo ?? null,
        descripcion: ruta.descripcion ?? null,
        tipoRuta: ruta.tipoRuta ?? null,
        estimacionMinutos: ruta.estimacionDuracionMinutos ?? null,
        estado: ej.estado,
        planificacionTiempoInicio: asig.planificacionTiempoInicio ?? null,
        planificacionTiempoFin: asig.planificacionTiempoFin ?? null,
        modeloVehiculo: veh.modelo ?? null,
        patente: veh.patente,
        capacidadKg:
          veh.capacidadKg != null ? Number(veh.capacidadKg) : null,
      };
    });

    return buildResponse(
      HttpStatus.OK,
      'Ejecuciones de ruta obtenidas correctamente según el filtro indicado.',
      items,
    );
  }

  async findOne(id: string) {
    const trimmed = id.trim();

    if (!trimmed) throw new BadRequestException('Debe indicar un id (UUID).');

    if (!isUuid(trimmed))
      throw new BadRequestException('El id debe ser un UUID válido.');

    const ruta = await this.cargarRutaCompleta(trimmed);

    if (!ruta)
      throw new NotFoundException(`No se encontró una ruta con id: ${trimmed}`);

    return buildResponse(HttpStatus.OK, 'Ruta obtenida correctamente', ruta);
  }

  async update(id: string, updateDto: UpdateRutaDto, user: Usuario) {
    const {
      nombre,
      codigo,
      descripcion,
      tipoRuta,
      estimacionDuracionMinutos,
      puntos,
    } = updateDto;

    if (
      nombre === undefined &&
      codigo === undefined &&
      descripcion === undefined &&
      tipoRuta === undefined &&
      estimacionDuracionMinutos === undefined &&
      puntos === undefined
    ) {
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'Debe enviar al menos un campo a actualizar.',
      );
    }

    const ruta = await this.rutaRepository.findOne({ where: { id } });

    if (!ruta)
      throw new NotFoundException(`No se encontró una ruta con id: ${id}`);

    const rutaPlanoAntes = await this.obtenerRutaPlanaParaAuditoriaPorId(id);

    if (puntos !== undefined) {
      const validacion = this.validarLineasPuntos(puntos);

      if (!validacion.ok)
        return buildResponse(validacion.status, validacion.message);

      if (puntos.length) {
        const errPuntos = await this.validarPuntosRecoleccionActivos(puntos);

        if (errPuntos) return errPuntos;
      }
    }

    if (nombre !== undefined) {
      const nombreTrim = nombre.trim();

      if (!nombreTrim)
        return buildResponse(
          HttpStatus.BAD_REQUEST,
          'El nombre de la ruta no puede estar vacío.',
        );

      if (nombreTrim !== ruta.nombre) {
        const otro = await this.rutaRepository.findOneBy({
          nombre: nombreTrim,
        });

        if (otro && otro.id !== id)
          return buildResponse(
            HttpStatus.CONFLICT,
            `Ya existe una ruta con el nombre: ${nombreTrim}.`,
          );
      }

      ruta.nombre = nombreTrim;
    }

    if (codigo !== undefined) {
      const codigoTrim = codigo.trim();
      const codigoFinal = codigoTrim.length ? codigoTrim : null;
      const actual = ruta.codigo ?? null;

      if (codigoFinal !== actual) {
        if (codigoFinal) {
          const otro = await this.rutaRepository.findOneBy({
            codigo: codigoFinal,
          });

          if (otro && otro.id !== id)
            return buildResponse(
              HttpStatus.CONFLICT,
              `Ya existe una ruta con el código: ${codigoFinal}.`,
            );
        }

        ruta.codigo = codigoFinal === null ? undefined : codigoFinal;
      }
    }

    if (descripcion !== undefined) {
      const descripcionTrim = descripcion.trim();
      ruta.descripcion = descripcionTrim.length ? descripcionTrim : undefined;
    }

    if (tipoRuta !== undefined) {
      const tipoTrim = tipoRuta.trim();
      ruta.tipoRuta = tipoTrim.length ? tipoTrim : undefined;
    }

    if (estimacionDuracionMinutos !== undefined)
      ruta.estimacionDuracionMinutos = estimacionDuracionMinutos;

    ruta.updatedAt = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(ruta);

      if (puntos !== undefined)
        await this.reemplazarPuntosRuta(queryRunner, id, puntos);

      const rutaPlanoDespues = await this.obtenerRutaPlanaParaAuditoria(
        queryRunner,
        id,
      );

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.RUTAS,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: rutaPlanoAntes,
        valorNuevo: rutaPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Ruta actualizada correctamente', {
        id,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async remove(id: string, user: Usuario) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const ruta = await queryRunner.manager.findOne(Ruta, {
        where: { id, isActive: true },
      });

      if (!ruta) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        return buildResponse(
          HttpStatus.NO_CONTENT,
          `No se encontró una ruta activa con el id ${id}`,
          { id },
        );
      }

      const rutaPlanoAntes = await this.obtenerRutaPlanaParaAuditoria(
        queryRunner,
        id,
      );

      ruta.isActive = false;
      ruta.updatedAt = new Date();
      await queryRunner.manager.save(ruta);

      const rutaPlanoDespues = await this.obtenerRutaPlanaParaAuditoria(
        queryRunner,
        id,
      );

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.RUTAS,
        accion: AccionAuditoriaEnum.DELETE,
        valorAntiguo: rutaPlanoAntes,
        valorNuevo: rutaPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Ruta eliminada correctamente', {
        id,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async rehabilitar(id: string, user: Usuario) {
    const ruta = await this.rutaRepository.findOne({
      where: { id, isActive: false },
    });

    if (!ruta)
      return buildResponse(
        HttpStatus.NO_CONTENT,
        `No se encontró una ruta inactiva con el id ${id}`,
        { id },
      );

    const rutaPlanoAntes = await this.obtenerRutaPlanaParaAuditoriaPorId(id);

    ruta.isActive = true;
    ruta.updatedAt = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(ruta);

      const rutaPlanoDespues = await this.obtenerRutaPlanaParaAuditoria(
        queryRunner,
        id,
      );

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.RUTAS,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: rutaPlanoAntes,
        valorNuevo: rutaPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Ruta rehabilitada correctamente', {
        id,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  private assertPuedeConsultarRutasAsignadas(
    solicitante: Usuario,
    filtro: 'conductor' | 'planificador' | 'supervisor',
    usuarioId: string,
  ) {
    const nombresRol =
      solicitante.usuarioRoles?.map((ur) => ur.rol?.nombre).filter(Boolean) ?? [];

    const puedeElevado = [
      RolesValidosEnum.ADMIN,
      RolesValidosEnum.PLANIFICADOR,
      RolesValidosEnum.SUPERVISOR,
    ].some((r) => nombresRol.includes(r));

    if (puedeElevado) return;

    const esConductor = nombresRol.includes(RolesValidosEnum.CONDUCTOR);

    if (filtro === 'conductor' && esConductor && solicitante.id === usuarioId)
      return;

    throw new ForbiddenException(
      'No tiene permiso para consultar rutas con el filtro indicado.',
    );
  }

  private validarLineasPuntos(lineas: PuntoRutaLineaDto[]) {
    const ordenes = new Set<number>();
    const puntosRecoleccion = new Set<string>();

    for (const linea of lineas) {
      if (ordenes.has(linea.ordenSecuencia)) {
        return {
          ok: false as const,
          status: HttpStatus.BAD_REQUEST,
          message: `El orden de secuencia ${linea.ordenSecuencia} está duplicado en la lista de puntos.`,
        };
      }

      ordenes.add(linea.ordenSecuencia);

      if (puntosRecoleccion.has(linea.puntoRecoleccionId)) {
        return {
          ok: false as const,
          status: HttpStatus.BAD_REQUEST,
          message: `El punto de recolección ${linea.puntoRecoleccionId} está repetido en la lista.`,
        };
      }

      puntosRecoleccion.add(linea.puntoRecoleccionId);
    }

    return { ok: true as const };
  }

  private async validarPuntosRecoleccionActivos(lineas: PuntoRutaLineaDto[]) {
    const ids = [...new Set(lineas.map((l) => l.puntoRecoleccionId))];

    const puntos = await this.puntoRecoleccionRepository.find({
      where: { id: In(ids), isActive: true },
    });

    if (puntos.length !== ids.length) {
      const encontrados = new Set(puntos.map((p) => p.id));
      const faltante = ids.find((i) => !encontrados.has(i));

      return buildResponse(
        HttpStatus.BAD_REQUEST,
        `No se encontró un punto de recolección activo con id: ${faltante}`,
      );
    }

    return null;
  }

  private async reemplazarPuntosRuta(
    queryRunner: QueryRunner,
    rutaId: string,
    lineas: PuntoRutaLineaDto[],
  ) {
    await queryRunner.manager.delete(PuntoRuta, { ruta: { id: rutaId } });

    const ordenadas = [...lineas].sort(
      (a, b) => a.ordenSecuencia - b.ordenSecuencia,
    );

    for (const linea of ordenadas) {
      const fila = queryRunner.manager.create(PuntoRuta, {
        ruta: { id: rutaId },
        puntoRecoleccion: { id: linea.puntoRecoleccionId },
        ordenSecuencia: linea.ordenSecuencia,
        estimacionParadaMinutos: linea.estimacionParadaMinutos,
      });

      await queryRunner.manager.save(fila);
    }
  }

  private ordenarPuntosRutaEnRuta(ruta: RutaConPuntos) {
    if (ruta.puntosRuta?.length)
      ruta.puntosRuta.sort((a, b) => a.ordenSecuencia - b.ordenSecuencia);
  }

  private async cargarPuntosRutaPorRutaId(
    rutaId: string,
    queryRunner?: QueryRunner,
  ): Promise<PuntoRuta[]> {
    const em = queryRunner
      ? queryRunner.manager
      : this.puntoRutaRepository.manager;

    return em.find(PuntoRuta, {
      where: { ruta: { id: rutaId } },
      relations: [...REL_PUNTO_RUTA_DETALLE],
      order: { ordenSecuencia: 'ASC' },
    });
  }

  private async adjuntarPuntosARuta(
    ruta: Ruta,
    queryRunner?: QueryRunner,
  ): Promise<RutaConPuntos> {
    const puntosRuta = await this.cargarPuntosRutaPorRutaId(ruta.id, queryRunner);
    const conPuntos: RutaConPuntos = { ...ruta, puntosRuta };
    this.ordenarPuntosRutaEnRuta(conPuntos);
    return conPuntos;
  }

  private async cargarRutaCompleta(id: string) {
    const ruta = await this.rutaRepository.findOne({ where: { id } });

    if (!ruta) return null;

    return this.adjuntarPuntosARuta(ruta);
  }

  private async obtenerRutaPlanaParaAuditoria(
    queryRunner: QueryRunner,
    id: string,
  ) {
    const ruta = await queryRunner.manager.findOne(Ruta, { where: { id } });

    if (!ruta)
      throw new InternalServerErrorException(
        'No se pudo cargar la ruta para auditoría.',
      );

    const conPuntos = await this.adjuntarPuntosARuta(ruta, queryRunner);

    return { ...conPuntos };
  }

  private async obtenerRutaPlanaParaAuditoriaPorId(id: string) {
    const ruta = await this.rutaRepository.findOne({ where: { id } });

    if (!ruta)
      throw new InternalServerErrorException(
        'No se pudo cargar la ruta para auditoría.',
      );

    const conPuntos = await this.adjuntarPuntosARuta(ruta);

    return { ...conPuntos };
  }

  private handleDbErrors(error: unknown): never {
    if (error && typeof error === 'object' && 'code' in error) {
      const e = error as { code?: string; detail?: string };
      if (e.code === '23505') throw new BadRequestException(e.detail);
    }

    console.log(error);

    throw new InternalServerErrorException('Ocurrió un error inesperado');
  }
}
