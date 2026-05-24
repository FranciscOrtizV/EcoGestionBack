import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  AsignacionRuta,
  EjecucionRuta,
  Evidencia,
  PuntoRutaEjecucion,
  Usuario,
} from 'src/common/entities';
import {
  EstadoAsignacionRutaEnum,
  EstadoEjecucionPuntoRutaEnum,
  EstadoEjecucionRutaEnum,
  RolesValidosEnum,
  TipoPuntoColeccionEnum,
  TurnoEnum,
} from 'src/common/enums';
import { buildResponse } from 'src/common/helpers';
import { IniciarEjecucionRutaDto } from './dto/iniciar-ejecucion-ruta.dto';

const ESTADOS_ASIGNACION_NO_INICIABLES = new Set<EstadoAsignacionRutaEnum>([
  EstadoAsignacionRutaEnum.COMPLETADO,
  EstadoAsignacionRutaEnum.CANCELADO,
]);

const ESTADOS_EJECUCION_NO_INICIABLES = new Set<EstadoEjecucionRutaEnum>([
  EstadoEjecucionRutaEnum.COMPLETADO,
  EstadoEjecucionRutaEnum.CANCELADO,
]);

export type EvidenciaPuntoItemDto = {
  id: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number | null;
  latitud: number | null;
  longitud: number | null;
  takenAt: Date | null;
  createdAt: Date;
};

export type PuntoEjecucionRutaItemDto = {
  id: string;
  nombre: string;
  direccion: string;
  nombreZona: string;
  estado: EstadoEjecucionPuntoRutaEnum;
  tiempoChequeo: Date | null;
  tipoPunto: TipoPuntoColeccionEnum;
  ordenSecuencia: number;
  latitud: number | null;
  longitud: number | null;
  comentarios: string | null;
  estimacionParadaMinutos: number | null;
  evidencias: EvidenciaPuntoItemDto[];
};

export type ResumenEjecucionRutaDto = {
  nombreRuta: string;
  codigoRuta: string | null;
  nombreCompletoConductor: string;
  patenteVehiculo: string;
  marcaVehiculo: string | null;
  modeloVehiculo: string | null;
  estadoEjecucion: string | null;
  turno: TurnoEnum;
  planificacionTiempoInicio: Date | null;
  planificacionTiempoFin: Date | null;
};

@Injectable()
export class EjecucionRutasService {
  constructor(
    @InjectRepository(EjecucionRuta)
    private readonly ejecucionRutaRepo: Repository<EjecucionRuta>,
    @InjectRepository(PuntoRutaEjecucion)
    private readonly puntoRutaEjecucionRepo: Repository<PuntoRutaEjecucion>,
    @InjectRepository(Evidencia)
    private readonly evidenciaRepo: Repository<Evidencia>,
    private readonly dataSource: DataSource,
  ) {}

  private mapEvidenciaToDto(evidencia: Evidencia): EvidenciaPuntoItemDto {
    return {
      id: evidencia.id,
      fileUrl: evidencia.fileUrl,
      fileName: evidencia.fileName,
      mimeType: evidencia.mimeType,
      fileSizeBytes:
        evidencia.fileSizeBytes != null
          ? Number(evidencia.fileSizeBytes)
          : null,
      latitud:
        evidencia.latitud != null ? Number(evidencia.latitud) : null,
      longitud:
        evidencia.longitud != null ? Number(evidencia.longitud) : null,
      takenAt: evidencia.takenAt ?? null,
      createdAt: evidencia.createdAt,
    };
  }

  async iniciar(
    ejecucionRutaId: string,
    dto: IniciarEjecucionRutaDto,
    user: Usuario,
  ) {
    const ejecucion = await this.ejecucionRutaRepo.findOne({
      where: { id: ejecucionRutaId },
      relations: {
        asignacionRuta: { conductor: true },
      },
    });

    if (!ejecucion?.asignacionRuta) {
      throw new NotFoundException(
        `No se encontró una ejecución de ruta con id: ${ejecucionRutaId}`,
      );
    }

    if (ejecucion.tiempoInicio) {
      return buildResponse(
        HttpStatus.CONFLICT,
        'La ejecución de ruta ya fue iniciada.',
      );
    }

    if (ESTADOS_EJECUCION_NO_INICIABLES.has(ejecucion.estado)) {
      return buildResponse(
        HttpStatus.CONFLICT,
        'No se puede iniciar una ejecución en estado completado o cancelado.',
      );
    }

    const asignacion = ejecucion.asignacionRuta;

    if (ESTADOS_ASIGNACION_NO_INICIABLES.has(asignacion.estado)) {
      return buildResponse(
        HttpStatus.CONFLICT,
        'No se puede iniciar una ejecución cuya asignación está completada o cancelada.',
      );
    }

    this.assertUsuarioPuedeIniciar(user, asignacion);

    const ahora = new Date();
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      ejecucion.tiempoInicio = ahora;
      ejecucion.estado = EstadoEjecucionRutaEnum.EN_PROGRESO;
      ejecucion.iniciadoPorUsuario = { id: user.id } as Usuario;
      ejecucion.latitudInicio = dto.latitudInicio;
      ejecucion.longitudInicio = dto.longitudInicio;
      ejecucion.odometroInicio = dto.odometroInicio;
      ejecucion.updatedAt = ahora;

      await queryRunner.manager.save(ejecucion);

      if (asignacion.estado !== EstadoAsignacionRutaEnum.EN_PROCESO) {
        asignacion.estado = EstadoAsignacionRutaEnum.EN_PROCESO;
        asignacion.updatedAt = ahora;
        await queryRunner.manager.save(asignacion);
      }

      await queryRunner.commitTransaction();
      await queryRunner.release();

      return buildResponse(HttpStatus.OK, 'Ejecución de ruta iniciada correctamente.', {
        ejecucionId: ejecucion.id,
        asignacionId: asignacion.id,
        tiempoInicio: ahora,
        latitudInicio: dto.latitudInicio,
        longitudInicio: dto.longitudInicio,
        odometroInicio: dto.odometroInicio,
      });
    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      throw error;
    }
  }

  private assertUsuarioPuedeIniciar(
    user: Usuario,
    asignacion: AsignacionRuta,
  ) {
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
      'No tiene permiso para iniciar esta ejecución de ruta.',
    );
  }

  async getResumenPorId(ejecucionRutaId: string): Promise<ResumenEjecucionRutaDto> {
    const ejecucion = await this.ejecucionRutaRepo.findOne({
      where: { id: ejecucionRutaId },
      relations: {
        asignacionRuta: {
          ruta: true,
          vehiculo: true,
          conductor: true,
        },
      },
    });

    if (!ejecucion?.asignacionRuta) {
      throw new NotFoundException(
        `No se encontró una ejecución de ruta con id: ${ejecucionRutaId}`,
      );
    }

    const { ruta, vehiculo, conductor, turno, planificacionTiempoInicio, planificacionTiempoFin } =
      ejecucion.asignacionRuta;

    const nombreCompletoConductor = [
      conductor.nombre,
      conductor.apellidoPaterno,
      conductor.apellidoMaterno,
    ]
      .map((p) => p?.trim())
      .filter(Boolean)
      .join(' ');

    return {
      nombreRuta: ruta.nombre,
      codigoRuta: ruta.codigo ?? null,
      nombreCompletoConductor,
      patenteVehiculo: vehiculo.patente,
      marcaVehiculo: vehiculo.marca ?? null,
      modeloVehiculo: vehiculo.modelo ?? null,
      estadoEjecucion: ejecucion.estado,
      turno,
      planificacionTiempoInicio: planificacionTiempoInicio ?? null,
      planificacionTiempoFin: planificacionTiempoFin ?? null,
    };
  }

  async getPuntosPorEjecucionId(
    ejecucionRutaId: string,
  ): Promise<PuntoEjecucionRutaItemDto[]> {
    const ejecucionExiste = await this.ejecucionRutaRepo.existsBy({
      id: ejecucionRutaId,
    });

    if (!ejecucionExiste) {
      throw new NotFoundException(
        `No se encontró una ejecución de ruta con id: ${ejecucionRutaId}`,
      );
    }

    const puntos = await this.puntoRutaEjecucionRepo.find({
      where: { ejecucionRuta: { id: ejecucionRutaId } },
      relations: {
        puntoRecoleccion: { zona: true },
        puntoRuta: true,
      },
      order: { ordenSecuencia: 'ASC' },
    });

    const puntoIds = puntos.map((punto) => punto.id);
    const evidenciasPorPunto = new Map<string, EvidenciaPuntoItemDto[]>();

    if (puntoIds.length > 0) {
      const evidencias = await this.evidenciaRepo.find({
        where: { puntoEjecucionRuta: { id: In(puntoIds) } },
        relations: { puntoEjecucionRuta: true },
        order: { createdAt: 'ASC' },
      });

      for (const evidencia of evidencias) {
        const puntoId = evidencia.puntoEjecucionRuta?.id;
        if (!puntoId) continue;

        const evidenciasPunto = evidenciasPorPunto.get(puntoId) ?? [];
        evidenciasPunto.push(this.mapEvidenciaToDto(evidencia));
        evidenciasPorPunto.set(puntoId, evidenciasPunto);
      }
    }

    return puntos.map((punto) => ({
      id: punto.id,
      nombre: punto.puntoRecoleccion.nombre,
      direccion: punto.puntoRecoleccion.direccion,
      nombreZona: punto.puntoRecoleccion.zona.nombre,
      estado: punto.estado,
      tiempoChequeo: punto.tiempoChequeo ?? null,
      tipoPunto: punto.puntoRecoleccion.tipoPunto,
      ordenSecuencia: punto.ordenSecuencia,
      latitud:
        punto.latitud != null ? Number(punto.latitud) : null,
      longitud:
        punto.longitud != null ? Number(punto.longitud) : null,
      comentarios: punto.comentarios ?? null,
      estimacionParadaMinutos:
        punto.puntoRuta.estimacionParadaMinutos ?? null,
      evidencias: evidenciasPorPunto.get(punto.id) ?? [],
    }));
  }
}
