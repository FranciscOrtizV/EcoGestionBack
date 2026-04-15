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
import { AuditoriaLog, TipoIncidencia, Usuario } from 'src/common/entities';
import { AccionAuditoriaEnum, EntidadesEnum } from 'src/common/enums';
import { buildResponse } from 'src/common/helpers';
import { CreateTiposIncidenciaDto } from './dto/create-tipos_incidencia.dto';
import { UpdateTiposIncidenciaDto } from './dto/update-tipos_incidencia.dto';

@Injectable()
export class TiposIncidenciasService {
  constructor(

    @InjectRepository(TipoIncidencia)
    private readonly tipoIncidenciaRepository: Repository<TipoIncidencia>,

    @InjectRepository(AuditoriaLog)
    private readonly auditoriaLogRepository: Repository<AuditoriaLog>,

    private readonly dataSource: DataSource,

  ) {}

  async create(createTiposIncidenciaDto: CreateTiposIncidenciaDto, user: Usuario) {
    const nombre = TipoIncidencia.normalizeNombre(createTiposIncidenciaDto.nombre);

    if (!nombre)
      return buildResponse(HttpStatus.BAD_REQUEST, 'El nombre del tipo de incidencia no puede estar vacío.');

    const existente = await this.tipoIncidenciaRepository.findOneBy({ nombre });

    if (existente)
      return buildResponse(HttpStatus.CONFLICT, `Ya existe un tipo de incidencia con el nombre: ${nombre}.`);

    const descripcion = createTiposIncidenciaDto.descripcion?.trim();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const nuevoTipo = this.tipoIncidenciaRepository.create({
        nombre,
        descripcion: descripcion || undefined,
      });

      await queryRunner.manager.save(nuevoTipo);

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.TIPOS_INCIDENCIA,
        accion: AccionAuditoriaEnum.CREATE,
        valorNuevo: nuevoTipo,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.CREATED, 'Tipo de incidencia creado correctamente', nuevoTipo);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async findAll() {
    const tipos = await this.tipoIncidenciaRepository.find({
      order: { nombre: 'ASC' },
    });

    return buildResponse(HttpStatus.OK, 'Listado de tipos de incidencia obtenido correctamente', tipos);
  }

  async findOne(id: string) {
    const trimmed = id.trim();

    if (!trimmed)
      throw new BadRequestException('Debe indicar un id (UUID).');

    if (!isUuid(trimmed))
      throw new BadRequestException('El id debe ser un UUID válido.');

    const tipo = await this.tipoIncidenciaRepository.findOne({ where: { id: trimmed } });

    if (!tipo)
      throw new NotFoundException(`No se encontró un tipo de incidencia con id: ${trimmed}`);

    return buildResponse(HttpStatus.OK, 'Tipo de incidencia obtenido correctamente', tipo);
    
  }

  async update(id: string, updateTiposIncidenciaDto: UpdateTiposIncidenciaDto, user: Usuario) {
    const { nombre, descripcion } = updateTiposIncidenciaDto;

    if (nombre === undefined && descripcion === undefined)
      return buildResponse(HttpStatus.BAD_REQUEST, 'Debe enviar al menos un campo a actualizar (nombre o descripción).');

    const tipo = await this.tipoIncidenciaRepository.findOne({ where: { id } });

    if (!tipo)
      throw new NotFoundException(`No se encontró un tipo de incidencia con id: ${id}`);

    const tipoPlanoAntes = { ...tipo };

    if (nombre !== undefined) {
      const nombreNorm = TipoIncidencia.normalizeNombre(nombre);

      if (!nombreNorm)
        return buildResponse(HttpStatus.BAD_REQUEST, 'El nombre del tipo de incidencia no puede estar vacío.');

      if (nombreNorm !== tipo.nombre) {
        const otro = await this.tipoIncidenciaRepository.findOneBy({ nombre: nombreNorm });

        if (otro && otro.id !== id)
          return buildResponse(HttpStatus.CONFLICT, `Ya existe un tipo de incidencia con el nombre: ${nombreNorm}.`);
      }

      tipo.nombre = nombreNorm;
    }

    if (descripcion !== undefined) {
      const descripcionTrim = descripcion.trim();
      tipo.descripcion = descripcionTrim.length ? descripcionTrim : undefined;
    }

    tipo.updatedAt = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(tipo);

      const tipoPlanoDespues = { ...tipo };

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.TIPOS_INCIDENCIA,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: tipoPlanoAntes,
        valorNuevo: tipoPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Tipo de incidencia actualizado correctamente', { id });
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
      const tipo = await queryRunner.manager.findOne(TipoIncidencia, {
        where: { id, isActive: true },
      });

      if (!tipo) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        return buildResponse(
          HttpStatus.NO_CONTENT,
          `No se encontró un tipo de incidencia activo con el id ${id}`,
          { id },
        );
      }

      const tipoPlanoAntes = { ...tipo };

      tipo.isActive = false;
      tipo.updatedAt = new Date();
      await queryRunner.manager.save(tipo);

      const tipoPlanoDespues = { ...tipo };

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.TIPOS_INCIDENCIA,
        accion: AccionAuditoriaEnum.DELETE,
        valorAntiguo: tipoPlanoAntes,
        valorNuevo: tipoPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Tipo de incidencia eliminado correctamente', {
        id,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async rehabilitar(id: string, user: Usuario) {
    const tipo = await this.tipoIncidenciaRepository.findOne({
      where: { id, isActive: false },
    });

    if (!tipo)
      return buildResponse(
        HttpStatus.NO_CONTENT,
        `No se encontró un tipo de incidencia inactivo con el id ${id}`,
        { id },
      );

    const tipoPlanoAntes = { ...tipo };

    tipo.isActive = true;
    tipo.updatedAt = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(tipo);

      const tipoPlanoDespues = { ...tipo };

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.TIPOS_INCIDENCIA,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: tipoPlanoAntes,
        valorNuevo: tipoPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Tipo de incidencia rehabilitado correctamente', {
        id,
      });
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
