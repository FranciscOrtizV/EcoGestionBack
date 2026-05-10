import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryRunner, Repository } from 'typeorm';
import {
  AsignacionRuta,
  AuditoriaLog,
  EjecucionRuta,
  PuntoRuta,
  PuntoRutaEjecucion,
  Ruta,
  Usuario,
  Vehiculo,
} from 'src/common/entities';
import {
  AccionAuditoriaEnum,
  EntidadesEnum,
  EstadoAsignacionRutaEnum,
  EstadoEjecucionPuntoRutaEnum,
  EstadoEjecucionRutaEnum,
  RolesValidosEnum,
  TurnoEnum,
} from 'src/common/enums';
import { buildResponse } from 'src/common/helpers';
import { CreateAsignacionRutaDto } from './dto/create-asignacion-ruta.dto';
import { UpdateAsignacionRutaDto } from './dto/update-asignacion-ruta.dto';

const REL_ASIGNACION_COMPLETA = [
  'ruta',
  'vehiculo',
  'conductor',
  'planificador',
  'supervisor',
] as const;

const ESTADOS_SIN_EDICION = new Set<EstadoAsignacionRutaEnum>([
  EstadoAsignacionRutaEnum.EN_PROCESO,
  EstadoAsignacionRutaEnum.COMPLETADO,
  EstadoAsignacionRutaEnum.CANCELADO,
]);

@Injectable()
export class AsignacionRutasService {
  private readonly logger = new Logger(AsignacionRutasService.name);

  constructor(
    @InjectRepository(AsignacionRuta)
    private readonly asignacionRepository: Repository<AsignacionRuta>,

    @InjectRepository(Ruta)
    private readonly rutaRepository: Repository<Ruta>,

    @InjectRepository(PuntoRuta)
    private readonly puntoRutaRepository: Repository<PuntoRuta>,

    @InjectRepository(Vehiculo)
    private readonly vehiculoRepository: Repository<Vehiculo>,

    @InjectRepository(Usuario)
    private readonly usuarioRepository: Repository<Usuario>,

    @InjectRepository(EjecucionRuta)
    private readonly ejecucionRutaRepository: Repository<EjecucionRuta>,

    @InjectRepository(AuditoriaLog)
    private readonly auditoriaLogRepository: Repository<AuditoriaLog>,

    private readonly dataSource: DataSource,
  ) {}

  async create(dto: CreateAsignacionRutaDto, user: Usuario) {
    const errTiempos = this.validarVentanaPlanificada(
      dto.planificacionTiempoInicio,
      dto.planificacionTiempoFin,
    );

    if (errTiempos) return errTiempos;

    const ruta = await this.rutaRepository.findOne({ where: { id: dto.rutaId } });

    if (!ruta?.isActive)
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'La ruta no existe o está inactiva.',
      );

    const vehiculo = await this.vehiculoRepository.findOne({
      where: { id: dto.vehiculoId },
    });

    if (!vehiculo?.isActive)
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'El vehículo no existe o está inactivo.',
      );

    const conductor = await this.cargarUsuarioConRoles(dto.conductorId);
    const planificador = await this.cargarUsuarioConRoles(dto.planificadorId);

    if (!conductor?.isActive)
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'El conductor no existe o está inactivo.',
      );

    if (!planificador?.isActive)
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'El planificador no existe o está inactivo.',
      );

    const rolConductor = this.validarRolUsuario(
      conductor,
      [RolesValidosEnum.CONDUCTOR],
      'conductor',
    );

    if (rolConductor) return rolConductor;

    const rolPlan = this.validarRolUsuario(
      planificador,
      [RolesValidosEnum.PLANIFICADOR],
      'planificador',
    );

    if (rolPlan) return rolPlan;

    let supervisor: Usuario | null = null;

    if (dto.supervisorId) {
      supervisor = await this.cargarUsuarioConRoles(dto.supervisorId);

      if (!supervisor?.isActive)
        return buildResponse(
          HttpStatus.BAD_REQUEST,
          'El supervisor no existe o está inactivo.',
        );

      const rolSup = this.validarRolUsuario(
        supervisor,
        [RolesValidosEnum.SUPERVISOR],
        'supervisor',
      );

      if (rolSup) return rolSup;
    }

    const confVeh = await this.existeConflictoVehiculoTurnoFecha(
      dto.vehiculoId,
      dto.fechaAsignacion,
      dto.turno,
    );

    if (confVeh)
      return buildResponse(
        HttpStatus.CONFLICT,
        'Ya existe una asignación para ese vehículo, fecha y turno.',
      );

    const confCond = await this.existeConflictoConductorTurnoFecha(
      dto.conductorId,
      dto.fechaAsignacion,
      dto.turno,
    );

    if (confCond)
      return buildResponse(
        HttpStatus.CONFLICT,
        'Ya existe una asignación para ese conductor, fecha y turno.',
      );

    const estado = dto.estado ?? EstadoAsignacionRutaEnum.BORRADOR;
    const publishedAt =
      estado === EstadoAsignacionRutaEnum.PUBLICADO ? new Date() : undefined;

    const nueva = this.asignacionRepository.create({
      ruta: { id: dto.rutaId },
      vehiculo: { id: dto.vehiculoId },
      conductor: { id: dto.conductorId },
      planificador: { id: dto.planificadorId },
      supervisor: supervisor ? { id: supervisor.id } : undefined,
      fechaAsignacion: dto.fechaAsignacion,
      turno: dto.turno,
      planificacionTiempoInicio: dto.planificacionTiempoInicio,
      planificacionTiempoFin: dto.planificacionTiempoFin,
      estado,
      notas: dto.notas,
      publishedAt,
    });

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(nueva);

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.ASIGNACION_RUTAS,
        accion: AccionAuditoriaEnum.CREATE,
        valorNuevo: await this.planoAuditoriaPorId(nueva.id, queryRunner),
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      const datos = await this.findOneEntity(nueva.id);

      if (!datos)
        throw new InternalServerErrorException(
          'No se pudo cargar la asignación recién creada.',
        );

      return buildResponse(
        HttpStatus.CREATED,
        'Asignación de ruta creada correctamente.',
        this.sanearAsignacion(datos),
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async findAll() {
    const lista = await this.asignacionRepository.find({
      relations: [...REL_ASIGNACION_COMPLETA],
      order: { fechaAsignacion: 'DESC', turno: 'ASC' },
    });

    return buildResponse(
      HttpStatus.OK,
      'Listado de asignaciones obtenido correctamente.',
      lista.map((a) => this.sanearAsignacion(a)),
    );
  }

  async findByDateRange(fechaInicio: string, fechaFin: string) {
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    if (fin.getTime() < inicio.getTime())
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'La fecha de fin debe ser igual o posterior a la fecha de inicio.',
      );

    const lista = await this.asignacionRepository
      .createQueryBuilder('asignacion')
      .leftJoinAndSelect('asignacion.ruta', 'ruta')
      .leftJoinAndSelect('asignacion.vehiculo', 'vehiculo')
      .leftJoinAndSelect('asignacion.conductor', 'conductor')
      .leftJoinAndSelect('asignacion.planificador', 'planificador')
      .leftJoinAndSelect('asignacion.supervisor', 'supervisor')
      .where('asignacion.fechaAsignacion >= :fechaInicio', { fechaInicio })
      .andWhere('asignacion.fechaAsignacion <= :fechaFin', { fechaFin })
      .orderBy('asignacion.fechaAsignacion', 'ASC')
      .addOrderBy('asignacion.turno', 'ASC')
      .getMany();

    return buildResponse(
      HttpStatus.OK,
      'Listado de asignaciones por rango de fechas obtenido correctamente.',
      lista.map((a) => this.sanearAsignacion(a)),
    );
  }

  async findOne(id: string) {
    const item = await this.findOneEntity(id);

    if (!item)
      throw new NotFoundException(
        `No se encontró una asignación de ruta con id: ${id}`,
      );

    const puntosRuta = await this.puntoRutaRepository.find({
      where: { ruta: { id: item.ruta.id } },
      relations: ['puntoRecoleccion'],
      order: { ordenSecuencia: 'ASC' },
    });

    const puntosRutaDetalle = puntosRuta.map((pr) => ({
      orden_secuencia: pr.ordenSecuencia,
      nombre_punto_recoleccion: pr.puntoRecoleccion.nombre,
      direccion: pr.puntoRecoleccion.direccion,
      referencia: pr.puntoRecoleccion.referencia,
      latitud: pr.puntoRecoleccion.latitud,
      longitud: pr.puntoRecoleccion.longitud,
      tipo_punto: pr.puntoRecoleccion.tipoPunto,
      prioridad: pr.puntoRecoleccion.prioridad,
    }));

    const asignacion = this.sanearAsignacion(item);

    return buildResponse(
      HttpStatus.OK,
      'Asignación obtenida correctamente.',
      {
        ...asignacion,
        puntosRuta: puntosRutaDetalle,
      },
    );
  }

  async update(id: string, dto: UpdateAsignacionRutaDto, user: Usuario) {
    const asignacion = await this.asignacionRepository.findOne({
      where: { id },
      relations: [...REL_ASIGNACION_COMPLETA],
    });

    if (!asignacion)
      throw new NotFoundException(
        `No se encontró una asignación de ruta con id: ${id}`,
      );

    if (ESTADOS_SIN_EDICION.has(asignacion.estado))
      return buildResponse(
        HttpStatus.CONFLICT,
        'No se puede modificar una asignación en estado en proceso, completado o cancelado.',
      );

    if (this.esUpdateVacio(dto))
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'Debe enviar al menos un campo a actualizar.',
      );

    const errTiempos = this.validarVentanaPlanificada(
      dto.planificacionTiempoInicio ?? asignacion.planificacionTiempoInicio,
      dto.planificacionTiempoFin ?? asignacion.planificacionTiempoFin,
    );

    if (errTiempos) return errTiempos;

    const antes = await this.planoAuditoriaPorId(id);

    const rutaId = dto.rutaId ?? asignacion.ruta.id;
    const vehiculoId = dto.vehiculoId ?? asignacion.vehiculo.id;
    const conductorId = dto.conductorId ?? asignacion.conductor.id;
    const planificadorId = dto.planificadorId ?? asignacion.planificador.id;
    const fechaAsignacion = dto.fechaAsignacion ?? asignacion.fechaAsignacion;
    const turno = dto.turno ?? asignacion.turno;

    if (dto.rutaId !== undefined) {
      const ruta = await this.rutaRepository.findOne({ where: { id: rutaId } });

      if (!ruta?.isActive)
        return buildResponse(
          HttpStatus.BAD_REQUEST,
          'La ruta no existe o está inactiva.',
        );

      asignacion.ruta = { id: rutaId } as Ruta;
    }

    if (dto.vehiculoId !== undefined) {
      const vehiculo = await this.vehiculoRepository.findOne({
        where: { id: vehiculoId },
      });

      if (!vehiculo?.isActive)
        return buildResponse(
          HttpStatus.BAD_REQUEST,
          'El vehículo no existe o está inactivo.',
        );

      asignacion.vehiculo = { id: vehiculoId } as Vehiculo;
    }

    if (dto.conductorId !== undefined) {
      const conductor = await this.cargarUsuarioConRoles(conductorId);

      if (!conductor?.isActive)
        return buildResponse(
          HttpStatus.BAD_REQUEST,
          'El conductor no existe o está inactivo.',
        );

      const rolC = this.validarRolUsuario(
        conductor,
        [RolesValidosEnum.CONDUCTOR],
        'conductor',
      );

      if (rolC) return rolC;

      asignacion.conductor = conductor;
    }

    if (dto.planificadorId !== undefined) {
      const planificador = await this.cargarUsuarioConRoles(planificadorId);

      if (!planificador?.isActive)
        return buildResponse(
          HttpStatus.BAD_REQUEST,
          'El planificador no existe o está inactivo.',
        );

      const rolP = this.validarRolUsuario(
        planificador,
        [RolesValidosEnum.PLANIFICADOR],
        'planificador',
      );

      if (rolP) return rolP;

      asignacion.planificador = planificador;
    }

    if (dto.supervisorId !== undefined) {
      if (dto.supervisorId === null) {
        asignacion.supervisor = null as unknown as Usuario;
      } else {
        const supervisor = await this.cargarUsuarioConRoles(dto.supervisorId);

        if (!supervisor?.isActive)
          return buildResponse(
            HttpStatus.BAD_REQUEST,
            'El supervisor no existe o está inactivo.',
          );

        const rolS = this.validarRolUsuario(
          supervisor,
          [RolesValidosEnum.SUPERVISOR],
          'supervisor',
        );

        if (rolS) return rolS;

        asignacion.supervisor = supervisor;
      }
    }

    if (dto.fechaAsignacion !== undefined)
      asignacion.fechaAsignacion = dto.fechaAsignacion;

    if (dto.turno !== undefined) asignacion.turno = dto.turno;

    if (dto.planificacionTiempoInicio !== undefined)
      asignacion.planificacionTiempoInicio = dto.planificacionTiempoInicio;

    if (dto.planificacionTiempoFin !== undefined)
      asignacion.planificacionTiempoFin = dto.planificacionTiempoFin;

    if (dto.notas !== undefined) asignacion.notas = dto.notas;

    if (dto.estado !== undefined) {
      asignacion.estado = dto.estado;

      if (
        dto.estado === EstadoAsignacionRutaEnum.PUBLICADO &&
        !asignacion.publishedAt
      )
        asignacion.publishedAt = new Date();
    }

    const confVeh = await this.existeConflictoVehiculoTurnoFecha(
      vehiculoId,
      fechaAsignacion,
      turno,
      id,
    );

    if (confVeh)
      return buildResponse(
        HttpStatus.CONFLICT,
        'Ya existe una asignación para ese vehículo, fecha y turno.',
      );

    const confCond = await this.existeConflictoConductorTurnoFecha(
      conductorId,
      fechaAsignacion,
      turno,
      id,
    );

    if (confCond)
      return buildResponse(
        HttpStatus.CONFLICT,
        'Ya existe una asignación para ese conductor, fecha y turno.',
      );

    asignacion.updatedAt = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(asignacion);

      const despues = await this.planoAuditoriaPorId(id, queryRunner);

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.ASIGNACION_RUTAS,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: antes,
        valorNuevo: despues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Asignación actualizada correctamente.', {
        id,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async inicio(id: string, user: Usuario) {
    const asignacion = await this.asignacionRepository.findOne({
      where: { id },
      relations: [...REL_ASIGNACION_COMPLETA],
    });

    if (!asignacion)
      throw new NotFoundException(
        `No se encontró una asignación de ruta con id: ${id}`,
      );

    if (ESTADOS_SIN_EDICION.has(asignacion.estado))
      return buildResponse(
        HttpStatus.CONFLICT,
        'No se puede iniciar una asignación en estado en proceso, completado o cancelado.',
      );

    this.assertUsuarioPuedeIniciar(user, asignacion);

    const existente = await this.ejecucionRutaRepository.findOne({
      where: { asignacionRuta: { id } },
    });

    if (existente?.tiempoInicio)
      return buildResponse(
        HttpStatus.CONFLICT,
        'La ejecución de esta asignación ya fue iniciada.',
      );

    const antesAsig = await this.planoAuditoriaPorId(id);

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const ahora = new Date();
      asignacion.estado = EstadoAsignacionRutaEnum.EN_PROCESO;
      asignacion.updatedAt = ahora;

      let ejecucion = existente;

      if (ejecucion) {
        ejecucion.tiempoInicio = ahora;
        ejecucion.estado = EstadoEjecucionRutaEnum.EN_PROGRESO;
        ejecucion.iniciadoPorUsuario = { id: user.id } as Usuario;
        await queryRunner.manager.save(ejecucion);
      } else {
        ejecucion = queryRunner.manager.create(EjecucionRuta, {
          asignacionRuta: { id },
          tiempoInicio: ahora,
          estado: EstadoEjecucionRutaEnum.EN_PROGRESO,
          iniciadoPorUsuario: { id: user.id } as Usuario,
        });

        await queryRunner.manager.save(ejecucion);
      }

      await queryRunner.manager.save(asignacion);

      const despuesAsig = await this.planoAuditoriaPorId(id, queryRunner);

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.ASIGNACION_RUTAS,
        accion: AccionAuditoriaEnum.START_ROUTE,
        valorAntiguo: antesAsig,
        valorNuevo: despuesAsig,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(
        HttpStatus.OK,
        'Asignación iniciada correctamente.',
        { id, ejecucionId: ejecucion.id },
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async publicarAsignacion(id: string, user: Usuario) {
    this.logger.log(
      `Publicar asignación: inicio asignacionId=${id} usuarioId=${user.id}`,
    );

    const asignacion = await this.findOneEntity(id);

    if (!asignacion) {
      this.logger.warn(`Publicar asignación: no encontrada asignacionId=${id}`);
      throw new NotFoundException(
        `No se encontró una asignación de ruta con id: ${id}`,
      );
    }

    if (ESTADOS_SIN_EDICION.has(asignacion.estado)) {
      this.logger.warn(
        `Publicar asignación: conflicto por estado asignacionId=${id} estado=${asignacion.estado}`,
      );
      return buildResponse(
        HttpStatus.CONFLICT,
        'No se puede publicar una asignación en estado en proceso, completado o cancelado.',
      );
    }

    if (asignacion.estado === EstadoAsignacionRutaEnum.PUBLICADO) {
      this.logger.warn(
        `Publicar asignación: ya publicada asignacionId=${id}`,
      );
      return buildResponse(
        HttpStatus.CONFLICT,
        'La asignación ya se encuentra publicada.',
      );
    }

    const antes = await this.planoAuditoriaPorId(id);
    const ahora = new Date();
    asignacion.estado = EstadoAsignacionRutaEnum.PUBLICADO;
    asignacion.publishedAt = asignacion.publishedAt ?? ahora;
    asignacion.updatedAt = ahora;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(asignacion);
      this.logger.log(
        `Publicar asignación: asignación guardada asignacionId=${id} rutaId=${asignacion.ruta.id}`,
      );

      let ejecucion = await queryRunner.manager.findOne(EjecucionRuta, {
        where: { asignacionRuta: { id } },
      });

      if (!ejecucion) {
        ejecucion = queryRunner.manager.create(EjecucionRuta, {
          asignacionRuta: { id },
          estado: EstadoEjecucionRutaEnum.NO_INICIADO,
        });
        ejecucion = await queryRunner.manager.save(ejecucion);
        this.logger.log(`Publicar asignación: ejecución creada ejecucionRutaId=${ejecucion.id} asignacionId=${id}`);
      } else {
        this.logger.log(`Publicar asignación: ejecución ya existía ejecucionRutaId=${ejecucion.id} asignacionId=${id}`);
      }

      console.log('Comenzamos la parte critica');
      console.log(ejecucion.id);

      const yaTienePuntosEjecucion =
        (await queryRunner.manager.count(PuntoRutaEjecucion, {
          where: { ejecucionRuta: { id: ejecucion.id } },
        })) > 0 || false;

        console.log(yaTienePuntosEjecucion);

      if (!yaTienePuntosEjecucion) {

        const puntosRuta = await queryRunner.manager.find(PuntoRuta, {
          where: { ruta: { id: asignacion.ruta.id } },
          relations: ['puntoRecoleccion'],
          order: { ordenSecuencia: 'ASC' },
        });

        console.log(puntosRuta);

        for (const pr of puntosRuta) {
          const pc = pr.puntoRecoleccion;
          const fila = queryRunner.manager.create(PuntoRutaEjecucion, {
            ejecucionRuta: { id: ejecucion.id },
            puntoRuta: { id: pr.id },
            puntoRecoleccion: { id: pc.id },
            estado: EstadoEjecucionPuntoRutaEnum.PENDIENTE,
            latitud: Number(pc.latitud),
            longitud: Number(pc.longitud),
            ordenSecuencia: pr.ordenSecuencia,
          });
          console.log(fila);
          await queryRunner.manager.save(fila);
        }
        this.logger.log(
          `Publicar asignación: puntos de ejecución creados ejecucionRutaId=${ejecucion.id} cantidad=${puntosRuta.length}`,
        );
      } else {
        this.logger.log(
          `Publicar asignación: puntos de ejecución ya existían, omitidos ejecucionRutaId=${ejecucion.id}`,
        );
      }

      const despues = await this.planoAuditoriaPorId(id, queryRunner);

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.ASIGNACION_RUTAS,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: antes,
        valorNuevo: despues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      this.logger.log(
        `Publicar asignación: transacción confirmada asignacionId=${id} ejecucionRutaId=${ejecucion.id}`,
      );

      return buildResponse(HttpStatus.OK, 'Asignación publicada correctamente.', {
        id,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.logger.error(
        `Publicar asignación: error y rollback asignacionId=${id}`,
        error instanceof Error ? error.stack : undefined,
      );
      this.handleDbErrors(error);
    }
  }

  private assertUsuarioPuedeIniciar(user: Usuario, asignacion: AsignacionRuta) {
    const nombresRol =
      user.usuarioRoles?.map((ur) => ur.rol?.nombre).filter(Boolean) ?? [];

    const puedeElevado = [
      RolesValidosEnum.ADMIN,
      RolesValidosEnum.PLANIFICADOR,
      RolesValidosEnum.SUPERVISOR,
    ].some((r) => nombresRol.includes(r));

    if (puedeElevado) return;

    const esConductor = nombresRol.includes(RolesValidosEnum.CONDUCTOR);

    if (esConductor && user.id === asignacion.conductor.id) return;

    throw new ForbiddenException(
      'No tiene permiso para iniciar esta asignación.',
    );
  }

  private async cargarUsuarioConRoles(
    id: string,
  ): Promise<Usuario | null> {
    return this.usuarioRepository.findOne({
      where: { id },
      relations: ['usuarioRoles', 'usuarioRoles.rol'],
    });
  }

  private validarRolUsuario(
    usuario: Usuario,
    roles: RolesValidosEnum[],
    etiqueta: string,
  ) {
    const nombres =
      usuario.usuarioRoles?.map((ur) => ur.rol?.nombre).filter(Boolean) ?? [];

    const ok =
      nombres.includes(RolesValidosEnum.ADMIN) ||
      roles.some((r) => nombres.includes(r));

    if (!ok)
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        `El usuario indicado como ${etiqueta} no tiene un rol válido para esa función.`,
      );

    return null;
  }

  private validarVentanaPlanificada(inicio?: Date, fin?: Date) {
    if (inicio && fin && fin.getTime() <= inicio.getTime())
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'La planificación de fin debe ser posterior al inicio.',
      );

    return null;
  }

  private esUpdateVacio(dto: UpdateAsignacionRutaDto) {
    return (
      dto.rutaId === undefined &&
      dto.vehiculoId === undefined &&
      dto.conductorId === undefined &&
      dto.planificadorId === undefined &&
      dto.supervisorId === undefined &&
      dto.fechaAsignacion === undefined &&
      dto.turno === undefined &&
      dto.planificacionTiempoInicio === undefined &&
      dto.planificacionTiempoFin === undefined &&
      dto.estado === undefined &&
      dto.notas === undefined
    );
  }

  private async existeConflictoVehiculoTurnoFecha(
    vehiculoId: string,
    fecha: string,
    turno: TurnoEnum,
    excludeId?: string,
  ) {
    const otro = await this.asignacionRepository.findOne({
      where: {
        vehiculo: { id: vehiculoId },
        fechaAsignacion: fecha,
        turno,
      },
    });

    return otro && otro.id !== excludeId;
  }

  private async existeConflictoConductorTurnoFecha(
    conductorId: string,
    fecha: string,
    turno: TurnoEnum,
    excludeId?: string,
  ) {
    const otro = await this.asignacionRepository.findOne({
      where: {
        conductor: { id: conductorId },
        fechaAsignacion: fecha,
        turno,
      },
    });

    return otro && otro.id !== excludeId;
  }

  private async findOneEntity(id: string) {
    return this.asignacionRepository.findOne({
      where: { id },
      relations: [...REL_ASIGNACION_COMPLETA],
    });
  }

  private sanearAsignacion(a: AsignacionRuta) {
    return {
      ...a,
      conductor: a.conductor ? this.sanearUsuario(a.conductor) : a.conductor,
      planificador: a.planificador
        ? this.sanearUsuario(a.planificador)
        : a.planificador,
      supervisor: a.supervisor
        ? this.sanearUsuario(a.supervisor)
        : a.supervisor,
    };
  }

  private sanearUsuario(u: Usuario) {
    const { password, ...rest } = u;

    return rest;
  }

  private async planoAuditoriaPorId(id: string, qr?: QueryRunner) {
    const em = qr ? qr.manager : this.asignacionRepository.manager;

    const row = await em.findOne(AsignacionRuta, {
      where: { id },
      relations: [...REL_ASIGNACION_COMPLETA],
    });

    if (!row) return {};

    const { conductor, planificador, supervisor, ...rest } = row;

    return {
      ...rest,
      conductor: conductor ? this.sanearUsuario(conductor) : conductor,
      planificador: planificador ? this.sanearUsuario(planificador) : planificador,
      supervisor: supervisor ? this.sanearUsuario(supervisor) : supervisor,
    };
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
