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
import { AuditoriaLog, Usuario, Vehiculo } from 'src/common/entities';
import { buildResponse } from 'src/common/helpers';
import { AccionAuditoriaEnum, EntidadesEnum } from 'src/common/enums';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';

@Injectable()
export class VehiculosService {
  constructor(
    @InjectRepository(Vehiculo)
    private readonly vehiculoRepository: Repository<Vehiculo>,

    @InjectRepository(AuditoriaLog)
    private readonly auditoriaLogRepository: Repository<AuditoriaLog>,

    private readonly dataSource: DataSource,
  ) {}

  async create(createVehiculoDto: CreateVehiculoDto, user: Usuario) {
    const patente = createVehiculoDto.patente.trim();

    const existentePatente = await this.vehiculoRepository.findOneBy({
      patente,
    });

    if (existentePatente)
      return buildResponse(HttpStatus.CONFLICT,`Ya existe un vehículo con la patente: ${patente}.`,);

    const codigoInterno = createVehiculoDto.codigoInterno?.trim();

    if (codigoInterno) {
      const existenteCodigo = await this.vehiculoRepository.findOneBy({ codigoInterno, });

      if (existenteCodigo)
        return buildResponse(HttpStatus.CONFLICT, `Ya existe un vehículo con el código interno: ${codigoInterno}.`);
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const nuevoVehiculo = this.vehiculoRepository.create({
        ...createVehiculoDto,
        patente,
        codigoInterno: codigoInterno || undefined,
      });

      await queryRunner.manager.save(nuevoVehiculo);

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.VEHICULOS,
        accion: AccionAuditoriaEnum.CREATE,
        valorNuevo: nuevoVehiculo,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.CREATED, 'Vehículo creado correctamente', nuevoVehiculo);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      console.log(error);
      this.handleDbErrors(error);
    }
  }

  async findAll() {
    const vehiculos = await this.vehiculoRepository.find({
      where: { isActive: true },
    });

    return buildResponse(HttpStatus.OK, 'Listado de vehículos obtenido correctamente', vehiculos);
  }

  async findOne(identificador: string) {
    const trimmed = identificador.trim();

    if (!trimmed)
      throw new BadRequestException(
        'Debe indicar un id (UUID), patente o código interno.',
      );

    let vehiculo: Vehiculo | null = null;

    if (isUuid(trimmed)) {
      vehiculo = await this.vehiculoRepository.findOne({
        where: { id: trimmed },
      });
    }

    if (!vehiculo) {
      vehiculo = await this.vehiculoRepository.findOne({
        where: [{ patente: trimmed }, { codigoInterno: trimmed }],
      });
    }

    if (!vehiculo)
      throw new NotFoundException(
        `No se encontró un vehículo con id, patente o código interno: ${trimmed}`,
      );

    return buildResponse(HttpStatus.OK, 'Vehículo obtenido correctamente', vehiculo);
  }

  async update(id: string, updateVehiculoDto: UpdateVehiculoDto, user: Usuario) {
    const vehiculo = await this.vehiculoRepository.findOne({ where: { id } });

    if (!vehiculo)
      throw new NotFoundException(`No se encontró un vehículo con id: ${id}`);

    const vehiculoPlanoAntes = { ...vehiculo };

    const { patente, codigoInterno, ...restoDto } = updateVehiculoDto;

    if (patente !== undefined) {

      const patenteTrim = patente.trim();

      if (patenteTrim !== vehiculo.patente) {
        const otro = await this.vehiculoRepository.findOneBy({ patente: patenteTrim });

        if (otro && otro.id !== id)
          return buildResponse(HttpStatus.CONFLICT, `Ya existe un vehículo con la patente: ${patenteTrim}.`);
      }

      vehiculo.patente = patenteTrim;
    }

    if (codigoInterno !== undefined) {
      const codigoTrim = codigoInterno.trim();
      const codigoFinal = codigoTrim.length ? codigoTrim : null;
      const actual = vehiculo.codigoInterno ?? null;

      if (codigoFinal !== actual) {
        if (codigoFinal) {
          const otro = await this.vehiculoRepository.findOneBy({codigoInterno: codigoFinal});

          if (otro && otro.id !== id)
            return buildResponse(HttpStatus.CONFLICT, `Ya existe un vehículo con el código interno: ${codigoFinal}.`);
        }

        vehiculo.codigoInterno = codigoFinal === null ? null : codigoFinal;
      }
    }

    Object.assign(vehiculo, restoDto);

    vehiculo.updatedAt = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(vehiculo);

      const vehiculoPlanoDespues = { ...vehiculo };

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.VEHICULOS,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: vehiculoPlanoAntes,
        valorNuevo: vehiculoPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Vehículo actualizado correctamente', { id });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      console.log(error);
      this.handleDbErrors(error);
    }
  }

  async remove(id: string, user: Usuario) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const vehiculo = await queryRunner.manager.findOne(Vehiculo, {
        where: { id, isActive: true },
      });

      if (!vehiculo)
        return buildResponse(HttpStatus.NO_CONTENT, `No se encontro un vehículo activo con el id ${id}`, { id } );

      const vehiculoPlanoAntes = { ...vehiculo };

      vehiculo.isActive = false;
      vehiculo.updatedAt = new Date();
      await queryRunner.manager.save(vehiculo);

      const vehiculoPlanoDespues = { ...vehiculo };

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.VEHICULOS,
        accion: AccionAuditoriaEnum.DELETE,
        valorAntiguo: vehiculoPlanoAntes,
        valorNuevo: vehiculoPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Vehículo eliminado correctamente', { id });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async rehabilitar(id: string, user: Usuario) {
    const vehiculo = await this.vehiculoRepository.findOne({
      where: { id, isActive: false },
    });

    if (!vehiculo)
      return buildResponse(
        HttpStatus.NO_CONTENT,
        `No se encontro un vehículo inactivo con el id ${id}`,
        { id },
      );

    const vehiculoPlanoAntes = { ...vehiculo };

    vehiculo.isActive = true;
    vehiculo.updatedAt = new Date();

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.save(vehiculo);

      const vehiculoPlanoDespues = { ...vehiculo };

      const registroAuditoria = this.auditoriaLogRepository.create({
        usuario: user,
        nombreEntidad: EntidadesEnum.VEHICULOS,
        accion: AccionAuditoriaEnum.UPDATE,
        valorAntiguo: vehiculoPlanoAntes,
        valorNuevo: vehiculoPlanoDespues,
        createdAt: new Date(),
      });

      await queryRunner.manager.save(registroAuditoria);

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Vehículo rehabilitado correctamente', { id });
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
