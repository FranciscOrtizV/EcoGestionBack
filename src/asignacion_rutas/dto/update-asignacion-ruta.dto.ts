import { Type } from 'class-transformer';
import {
  IsDate,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { EstadoAsignacionRutaEnum, TurnoEnum } from 'src/common/enums';

export class UpdateAsignacionRutaDto {
  @IsUUID()
  @IsOptional()
  rutaId?: string;

  @IsUUID()
  @IsOptional()
  vehiculoId?: string;

  @IsUUID()
  @IsOptional()
  conductorId?: string;

  @IsUUID()
  @IsOptional()
  planificadorId?: string;

  @ValidateIf((_, v) => v !== null && v !== undefined)
  @IsUUID()
  @IsOptional()
  supervisorId?: string | null;

  @IsDateString()
  @IsOptional()
  fechaAsignacion?: string;

  @IsEnum(TurnoEnum)
  @IsOptional()
  turno?: TurnoEnum;

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
