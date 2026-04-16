import {
  BadRequestException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { validate as isUuid } from 'uuid';
import { AuditoriaLog, PuntoRecoleccion, Usuario, Zona } from 'src/common/entities';
import { AccionAuditoriaEnum, EntidadesEnum } from 'src/common/enums';
import { buildResponse } from 'src/common/helpers';
import { CreatePuntoRecoleccionDto } from './dto/create-punto-recoleccion.dto';
import { UpdatePuntoRecoleccionDto } from './dto/update-punto-recoleccion.dto';

@Injectable()
export class PuntosRecoleccionService {
  constructor(
    @InjectRepository(PuntoRecoleccion)
    private readonly puntoRecoleccionRepository: Repository<PuntoRecoleccion>,

    @InjectRepository(Zona)
    private readonly zonaRepository: Repository<Zona>,

    @InjectRepository(AuditoriaLog)
    private readonly auditoriaLogRepository: Repository<AuditoriaLog>,

    private readonly dataSource: DataSource,
  ) {}

  async create(createDto: CreatePuntoRecoleccionDto, user: Usuario) {
    const nombre = createDto.nombre.trim();
    const direccion = createDto.direccion.trim();

    if (!nombre)
      return buildResponse(HttpStatus.BAD_REQUEST, 'El nombre del punto no puede estar vacío.');

    if (!direccion)
      return buildResponse(HttpStatus.BAD_REQUEST, 'La dirección no puede estar vacía.');

    const zona = await this.zonaRepository.findOne({
      where: { id: createDto.zonaId, isActive: true },
    });

    if (!zona)
      throw new NotFoundException(
        `No se encontró una zona activa con id: ${createDto.zonaId}`,
      );

    const referencia = createDto.referencia?.trim();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const nuevo = this.puntoRecoleccionRepository.create({
        nombre,
        direccion,
        referencia: referencia?.length ? referencia : undefined,
        latitud: createDto.latitud,
        longitud: createDto.longitud,
        tipoPunto: createDto.tipoPunto,
        prioridad: createDto.prioridad,
        zona,
      });

      await queryRunner.manager.save(nuevo);

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.PUNTOS_RECOLECCION,
        accion: AccionAuditoriaEnum.CREATE,
        valorNuevo: nuevo,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.CREATED, 'Punto de recolección creado correctamente', nuevo);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async findAll(incluirInactivos = false) {
    const puntos = await this.puntoRecoleccionRepository.find({
      where: incluirInactivos ? {} : { isActive: true },
      relations: ['zona'],
      order: { nombre: 'ASC' },
    });

    return buildResponse(
      HttpStatus.OK,
      'Listado de puntos de recolección obtenido correctamente',
      puntos,
    );
  }

  async findOne(id: string) {
    const trimmed = id.trim();

    if (!trimmed)
      throw new BadRequestException('Debe indicar un id (UUID).');

    if (!isUuid(trimmed))
      throw new BadRequestException('El id debe ser un UUID válido.');

    const punto = await this.puntoRecoleccionRepository.findOne({
      where: { id: trimmed },
      relations: ['zona'],
    });

    if (!punto)
      throw new NotFoundException(`No se encontró un punto de recolección con id: ${trimmed}`);

    return buildResponse(HttpStatus.OK, 'Punto de recolección obtenido correctamente', punto);
  }

  async update(id: string, updateDto: UpdatePuntoRecoleccionDto, user: Usuario) {
    const {
      zonaId,
      nombre,
      direccion,
      referencia,
      latitud,
      longitud,
      tipoPunto,
      prioridad,
    } = updateDto;

    if (
      zonaId === undefined &&
      nombre === undefined &&
      direccion === undefined &&
      referencia === undefined &&
      latitud === undefined &&
      longitud === undefined &&
      tipoPunto === undefined &&
      prioridad === undefined
    ) {
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'Debe enviar al menos un campo a actualizar.',
      );
    }

    const punto = await this.puntoRecoleccionRepository.findOne({
      where: { id },
      relations: ['zona'],
    });

    if (!punto)
      throw new NotFoundException(`No se encontró un punto de recolección con id: ${id}`);

    const puntoPlanoAntes = { ...punto };

    if (zonaId !== undefined) {
      const zona = await this.zonaRepository.findOne({
        where: { id: zonaId, isActive: true },
      });

      if (!zona)
        throw new NotFoundException(`No se encontró una zona activa con id: ${zonaId}`);

      punto.zona = zona;
    }

    if (nombre !== undefined) {
      const nombreTrim = nombre.trim();

      if (!nombreTrim)
        return buildResponse(HttpStatus.BAD_REQUEST, 'El nombre del punto no puede estar vacío.');

      punto.nombre = nombreTrim;
    }

    if (direccion !== undefined) {
      const direccionTrim = direccion.trim();

      if (!direccionTrim)
        return buildResponse(HttpStatus.BAD_REQUEST, 'La dirección no puede estar vacía.');

      punto.direccion = direccionTrim;
    }

    if (referencia !== undefined) {
      const refTrim = referencia.trim();
      punto.referencia = refTrim.length ? refTrim : undefined;
    }

    if (latitud !== undefined) punto.latitud = latitud;
    if (longitud !== undefined) punto.longitud = longitud;
    if (tipoPunto !== undefined) punto.tipoPunto = tipoPunto;
    if (prioridad !== undefined) punto.prioridad = prioridad;

    punto.updatedAt = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(punto);

      const puntoPlanoDespues = { ...punto };

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.PUNTOS_RECOLECCION,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: puntoPlanoAntes,
        valorNuevo: puntoPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Punto de recolección actualizado correctamente', {
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
      const punto = await queryRunner.manager.findOne(PuntoRecoleccion, {
        where: { id, isActive: true },
        relations: ['zona'],
      });

      if (!punto) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        return buildResponse(
          HttpStatus.NO_CONTENT,
          `No se encontró un punto de recolección activo con el id ${id}`,
          { id },
        );
      }

      const puntoPlanoAntes = { ...punto };

      punto.isActive = false;
      punto.updatedAt = new Date();
      await queryRunner.manager.save(punto);

      const puntoPlanoDespues = { ...punto };

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.PUNTOS_RECOLECCION,
        accion: AccionAuditoriaEnum.DELETE,
        valorAntiguo: puntoPlanoAntes,
        valorNuevo: puntoPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Punto de recolección eliminado correctamente', { id });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async rehabilitar(id: string, user: Usuario) {
    const punto = await this.puntoRecoleccionRepository.findOne({
      where: { id, isActive: false },
      relations: ['zona'],
    });

    if (!punto)
      return buildResponse(
        HttpStatus.NO_CONTENT,
        `No se encontró un punto de recolección inactivo con el id ${id}`,
        { id },
      );

    const puntoPlanoAntes = { ...punto };

    punto.isActive = true;
    punto.updatedAt = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(punto);

      const puntoPlanoDespues = { ...punto };

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.PUNTOS_RECOLECCION,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: puntoPlanoAntes,
        valorNuevo: puntoPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(
        HttpStatus.OK,
        'Punto de recolección rehabilitado correctamente',
        { id },
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  private handleDbErrors(error: any): never {
    if (error.code === '23505')
      throw new BadRequestException(error.detail);

    console.log(error);

    throw new InternalServerErrorException('Ocurrió un error inesperado');
  }
}
