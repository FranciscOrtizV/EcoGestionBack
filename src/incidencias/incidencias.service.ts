import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { validate as isUuid } from 'uuid';
import { Evidencia, Incidencia, Ruta, Usuario } from 'src/common/entities';
import { EstadoIncidenciaEnum } from 'src/common/enums';
import { buildResponse } from 'src/common/helpers';
import { ResolverIncidenciaDto } from './dto/resolver-incidencia.dto';

const ESTADOS_RESOLUCION_VALIDOS = new Set<EstadoIncidenciaEnum>([
  EstadoIncidenciaEnum.RESUELTA,
  EstadoIncidenciaEnum.CERRADA,
]);

const RELACIONES_INCIDENCIA = {
  tipoIncidencia: true,
  reportadoPorUsuario: true,
  asignadoAUsuario: true,
  ejecucionRuta: {
    asignacionRuta: { ruta: true },
  },
  puntoEjecucionRuta: {
    puntoRecoleccion: true,
    ejecucionRuta: {
      asignacionRuta: { ruta: true },
    },
  },
} as const;

export type IncidenciaListItemDto = {
  id: string;
  tipoIncidencia: { id: string; nombre: string };
  ruta: { id: string; nombre: string; codigo: string | null } | null;
  puntoRecoleccion: { id: string; nombre: string; direccion: string } | null;
  reportadoPor: { id: string; nombreCompleto: string };
  titulo: string;
  descripcion: string | null;
  estado: string;
  prioridad: string;
  fechaReporte: Date;
};

export type IncidenciaEvidenciaItemDto = {
  id: string;
  fileUrl: string;
  urlFoto: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number | null;
  latitud: number | null;
  longitud: number | null;
  takenAt: Date | null;
  createdAt: Date;
};

export type IncidenciaDetalleDto = {
  id: string;
  titulo: string;
  tipoIncidencia: { id: string; nombre: string };
  ruta: { id: string; nombre: string; codigo: string | null } | null;
  puntoRecoleccion: { id: string; nombre: string; direccion: string } | null;
  reportadoPor: { id: string; nombreCompleto: string };
  resueltoPor: { id: string; nombreCompleto: string } | null;
  descripcion: string | null;
  estado: string;
  prioridad: string;
  latitud: number | null;
  longitud: number | null;
  evidencias: IncidenciaEvidenciaItemDto[];
  comentarioResolucion: string | null;
  fechaResolucion: Date | null;
};

@Injectable()
export class IncidenciasService {
  constructor(
    @InjectRepository(Incidencia)
    private readonly incidenciaRepository: Repository<Incidencia>,

    @InjectRepository(Evidencia)
    private readonly evidenciaRepository: Repository<Evidencia>,
  ) {}

  async findAll() {
    const incidencias = await this.incidenciaRepository.find({
      relations: RELACIONES_INCIDENCIA,
      order: { reportedAt: 'DESC' },
    });

    return buildResponse(
      HttpStatus.OK,
      'Listado de incidencias obtenido correctamente.',
      incidencias.map((incidencia) => this.mapIncidenciaListItem(incidencia)),
    );
  }

  async findOne(id: string) {
    const trimmed = id.trim();

    if (!trimmed) {
      throw new BadRequestException('Debe indicar un id (UUID).');
    }

    if (!isUuid(trimmed)) {
      throw new BadRequestException('El id debe ser un UUID válido.');
    }

    const incidencia = await this.incidenciaRepository.findOne({
      where: { id: trimmed },
      relations: RELACIONES_INCIDENCIA,
    });

    if (!incidencia) {
      throw new NotFoundException(`No se encontró una incidencia con id: ${trimmed}`);
    }

    const evidencias = await this.evidenciaRepository.find({
      where: { incidencia: { id: trimmed } },
      order: { createdAt: 'ASC' },
    });

    return buildResponse(
      HttpStatus.OK,
      'Detalle de incidencia obtenido correctamente.',
      this.mapIncidenciaDetalle(incidencia, evidencias),
    );
  }

  async resolver(id: string, dto: ResolverIncidenciaDto, user: Usuario) {
    if (!ESTADOS_RESOLUCION_VALIDOS.has(dto.estado)) {
      return buildResponse(
        HttpStatus.BAD_REQUEST,
        'El estado debe ser RESUELTA o CERRADA para registrar la resolución.',
      );
    }

    const incidencia = await this.incidenciaRepository.findOne({
      where: { id },
    });

    if (!incidencia) {
      throw new NotFoundException(`No se encontró una incidencia con id: ${id}`);
    }

    if (
      incidencia.estado === EstadoIncidenciaEnum.RESUELTA ||
      incidencia.estado === EstadoIncidenciaEnum.CERRADA
    ) {
      return buildResponse(
        HttpStatus.CONFLICT,
        'La incidencia ya fue resuelta o cerrada y no puede modificarse.',
      );
    }

    const comentarioResolucion = dto.comentarioResolucion.trim();
    const ahora = new Date();

    incidencia.estado = dto.estado;
    incidencia.comentarioResolucion = comentarioResolucion;
    incidencia.resolvedAt = ahora;
    incidencia.asignadoAUsuario = user;
    incidencia.updatedAt = ahora;

    const incidenciaActualizada = await this.incidenciaRepository.save(incidencia);

    return buildResponse(
      HttpStatus.OK,
      'Incidencia resuelta correctamente.',
      {
        id: incidenciaActualizada.id,
        estado: incidenciaActualizada.estado,
        comentarioResolucion: incidenciaActualizada.comentarioResolucion,
        fechaResolucion: incidenciaActualizada.resolvedAt,
        resueltoPor: this.mapUsuarioResumen(user),
      },
    );
  }

  private mapIncidenciaListItem(incidencia: Incidencia): IncidenciaListItemDto {
    const ruta = this.obtenerRuta(incidencia);
    const puntoRecoleccion = incidencia.puntoEjecucionRuta?.puntoRecoleccion;

    return {
      id: incidencia.id,
      tipoIncidencia: {
        id: incidencia.tipoIncidencia.id,
        nombre: incidencia.tipoIncidencia.nombre,
      },
      ruta: ruta
        ? {
            id: ruta.id,
            nombre: ruta.nombre,
            codigo: ruta.codigo ?? null,
          }
        : null,
      puntoRecoleccion: puntoRecoleccion
        ? {
            id: puntoRecoleccion.id,
            nombre: puntoRecoleccion.nombre,
            direccion: puntoRecoleccion.direccion,
          }
        : null,
      reportadoPor: this.mapUsuarioResumen(incidencia.reportadoPorUsuario),
      titulo: incidencia.titulo,
      descripcion: incidencia.descripcion ?? null,
      estado: incidencia.estado,
      prioridad: incidencia.prioridad,
      fechaReporte: incidencia.reportedAt,
    };
  }

  private mapIncidenciaDetalle(
    incidencia: Incidencia,
    evidencias: Evidencia[],
  ): IncidenciaDetalleDto {
    const ruta = this.obtenerRuta(incidencia);
    const puntoRecoleccion = incidencia.puntoEjecucionRuta?.puntoRecoleccion;

    return {
      id: incidencia.id,
      titulo: incidencia.titulo,
      tipoIncidencia: {
        id: incidencia.tipoIncidencia.id,
        nombre: incidencia.tipoIncidencia.nombre,
      },
      ruta: ruta
        ? {
            id: ruta.id,
            nombre: ruta.nombre,
            codigo: ruta.codigo ?? null,
          }
        : null,
      puntoRecoleccion: puntoRecoleccion
        ? {
            id: puntoRecoleccion.id,
            nombre: puntoRecoleccion.nombre,
            direccion: puntoRecoleccion.direccion,
          }
        : null,
      reportadoPor: this.mapUsuarioResumen(incidencia.reportadoPorUsuario),
      resueltoPor: this.mapResueltoPor(incidencia),
      descripcion: incidencia.descripcion ?? null,
      estado: incidencia.estado,
      prioridad: incidencia.prioridad,
      latitud: incidencia.latitud != null ? Number(incidencia.latitud) : null,
      longitud: incidencia.longitud != null ? Number(incidencia.longitud) : null,
      evidencias: evidencias.map((evidencia) => this.mapEvidenciaToDto(evidencia)),
      comentarioResolucion: incidencia.comentarioResolucion ?? null,
      fechaResolucion: incidencia.resolvedAt ?? null,
    };
  }

  private mapEvidenciaToDto(evidencia: Evidencia): IncidenciaEvidenciaItemDto {
    const fileUrl = evidencia.fileUrl;

    return {
      id: evidencia.id,
      fileUrl,
      urlFoto: this.resolverUrlFoto(fileUrl),
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

  private resolverUrlFoto(fileUrl: string): string {
    if (/^https?:\/\//i.test(fileUrl)) return fileUrl;

    const base = (process.env.API_PUBLIC_URL ?? '').replace(/\/$/, '');
    return base ? `${base}${fileUrl}` : fileUrl;
  }

  private mapUsuarioResumen(usuario: Usuario) {
    return {
      id: usuario.id,
      nombreCompleto: this.nombreCompletoUsuario(usuario),
    };
  }

  private mapResueltoPor(incidencia: Incidencia) {
    if (!incidencia.asignadoAUsuario) {
      return null;
    }

    const estaResuelta =
      incidencia.estado === EstadoIncidenciaEnum.RESUELTA ||
      incidencia.estado === EstadoIncidenciaEnum.CERRADA ||
      incidencia.resolvedAt != null;

    if (!estaResuelta) {
      return null;
    }

    return this.mapUsuarioResumen(incidencia.asignadoAUsuario);
  }

  private obtenerRuta(incidencia: Incidencia): Ruta | undefined {
    return (
      incidencia.ejecucionRuta?.asignacionRuta?.ruta ??
      incidencia.puntoEjecucionRuta?.ejecucionRuta?.asignacionRuta?.ruta
    );
  }

  private nombreCompletoUsuario(usuario: Usuario): string {
    return [usuario.nombre, usuario.apellidoPaterno, usuario.apellidoMaterno]
      .map((parte) => parte?.trim())
      .filter(Boolean)
      .join(' ');
  }
}
