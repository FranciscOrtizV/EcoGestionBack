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
import { AuditoriaLog, Usuario, Zona } from 'src/common/entities';
import { AccionAuditoriaEnum, EntidadesEnum } from 'src/common/enums';
import { buildResponse } from 'src/common/helpers';
import { CreateZonaDto } from './dto/create-zona.dto';
import { UpdateZonaDto } from './dto/update-zona.dto';

@Injectable()
export class ZonasService {
  constructor(
    @InjectRepository(Zona)
    private readonly zonaRepository: Repository<Zona>,

    @InjectRepository(AuditoriaLog)
    private readonly auditoriaLogRepository: Repository<AuditoriaLog>,

    private readonly dataSource: DataSource,
  ) {}

  async create(createZonaDto: CreateZonaDto, user: Usuario) {
    const nombre = createZonaDto.nombre.trim();

    if (!nombre)
      return buildResponse(HttpStatus.BAD_REQUEST, 'El nombre de la zona no puede estar vacío.');

    const existenteNombre = await this.zonaRepository.findOneBy({ nombre });

    if (existenteNombre)
      return buildResponse(HttpStatus.CONFLICT, `Ya existe una zona con el nombre: ${nombre}.`);

    const codigoTrim = createZonaDto.codigo?.trim();
    const codigoFinal = codigoTrim?.length ? codigoTrim : undefined;

    if (codigoFinal) {
      const existenteCodigo = await this.zonaRepository.findOneBy({ codigo: codigoFinal });

      if (existenteCodigo)
        return buildResponse(HttpStatus.CONFLICT, `Ya existe una zona con el código: ${codigoFinal}.`);
    }

    const descripcion = createZonaDto.descripcion?.trim();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const nuevaZona = this.zonaRepository.create({
        nombre,
        codigo: codigoFinal,
        descripcion: descripcion || undefined,
      });

      await queryRunner.manager.save(nuevaZona);

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.ZONAS,
        accion: AccionAuditoriaEnum.CREATE,
        valorNuevo: nuevaZona,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.CREATED, 'Zona creada correctamente', nuevaZona);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async findAll() {
    const zonas = await this.zonaRepository.find({
      order: { nombre: 'ASC' },
    });

    return buildResponse(HttpStatus.OK, 'Listado de zonas obtenido correctamente', zonas);
  }

  async findOne(id: string) {
    const trimmed = id.trim();

    if (!trimmed)
      throw new BadRequestException('Debe indicar un id (UUID).');

    if (!isUuid(trimmed))
      throw new BadRequestException('El id debe ser un UUID válido.');

    const zona = await this.zonaRepository.findOne({ where: { id: trimmed } });

    if (!zona)
      throw new NotFoundException(`No se encontró una zona con id: ${trimmed}`);

    return buildResponse(HttpStatus.OK, 'Zona obtenida correctamente', zona);
  }

  async update(id: string, updateZonaDto: UpdateZonaDto, user: Usuario) {
    const { nombre, codigo, descripcion } = updateZonaDto;

    if (nombre === undefined && codigo === undefined && descripcion === undefined)
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'Debe enviar al menos un campo a actualizar (nombre, código o descripción).',
      );

    const zona = await this.zonaRepository.findOne({ where: { id } });

    if (!zona)
      throw new NotFoundException(`No se encontró una zona con id: ${id}`);

    const zonaPlanoAntes = { ...zona };

    if (nombre !== undefined) {
      const nombreTrim = nombre.trim();

      if (!nombreTrim)
        return buildResponse(HttpStatus.BAD_REQUEST, 'El nombre de la zona no puede estar vacío.');

      if (nombreTrim !== zona.nombre) {
        const otro = await this.zonaRepository.findOneBy({ nombre: nombreTrim });

        if (otro && otro.id !== id)
          return buildResponse(HttpStatus.CONFLICT, `Ya existe una zona con el nombre: ${nombreTrim}.`);
      }

      zona.nombre = nombreTrim;
    }

    if (codigo !== undefined) {
      const codigoTrim = codigo.trim();
      const codigoFinal = codigoTrim.length ? codigoTrim : null;
      const actual = zona.codigo ?? null;

      if (codigoFinal !== actual) {
        if (codigoFinal) {
          const otro = await this.zonaRepository.findOneBy({ codigo: codigoFinal });

          if (otro && otro.id !== id)
            return buildResponse(HttpStatus.CONFLICT, `Ya existe una zona con el código: ${codigoFinal}.`);
        }

        zona.codigo = codigoFinal === null ? undefined : codigoFinal;
      }
    }

    if (descripcion !== undefined) {
      const descripcionTrim = descripcion.trim();
      zona.descripcion = descripcionTrim.length ? descripcionTrim : undefined;
    }

    zona.updatedAt = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(zona);

      const zonaPlanoDespues = { ...zona };

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.ZONAS,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: zonaPlanoAntes,
        valorNuevo: zonaPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Zona actualizada correctamente', { id });
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
      const zona = await queryRunner.manager.findOne(Zona, {
        where: { id, isActive: true },
      });

      if (!zona) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        return buildResponse(
          HttpStatus.NO_CONTENT,
          `No se encontró una zona activa con el id ${id}`,
          { id },
        );
      }

      const zonaPlanoAntes = { ...zona };

      zona.isActive = false;
      zona.updatedAt = new Date();
      await queryRunner.manager.save(zona);

      const zonaPlanoDespues = { ...zona };

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.ZONAS,
        accion: AccionAuditoriaEnum.DELETE,
        valorAntiguo: zonaPlanoAntes,
        valorNuevo: zonaPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Zona eliminada correctamente', { id });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async rehabilitar(id: string, user: Usuario) {
    const zona = await this.zonaRepository.findOne({
      where: { id, isActive: false },
    });

    if (!zona)
      return buildResponse(
        HttpStatus.NO_CONTENT,
        `No se encontró una zona inactiva con el id ${id}`,
        { id },
      );

    const zonaPlanoAntes = { ...zona };

    zona.isActive = true;
    zona.updatedAt = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(zona);

      const zonaPlanoDespues = { ...zona };

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.ZONAS,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: zonaPlanoAntes,
        valorNuevo: zonaPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Zona rehabilitada correctamente', { id });
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
