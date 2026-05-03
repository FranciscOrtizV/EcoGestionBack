import { Type } from 'class-transformer';
import {
  IsDate,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { EstadoAsignacionRutaEnum, TurnoEnum } from 'src/common/enums';

export class CreateAsignacionRutaDto {
  @IsUUID()
  rutaId: string;

  @IsUUID()
  vehiculoId: string;

  @IsUUID()
  conductorId: string;

  @IsUUID()
  planificadorId: string;

  @IsUUID()
  @IsOptional()
  supervisorId?: string;

  @IsDateString()
  fechaAsignacion: string;

  @IsEnum(TurnoEnum)
  turno: TurnoEnum;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  planificacionTiempoInicio?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  planificacionTiempoFin?: Date;

  @IsEnum(EstadoAsignacionRutaEnum)
  @IsOptional()
  estado?: EstadoAsignacionRutaEnum;

  @IsString()
  @IsOptional()
  @MaxLength(20000)
  notas?: string;
}
