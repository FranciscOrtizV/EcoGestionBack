import { Type } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PrioridadIncidenciaEnum } from 'src/common/enums';

export class RegistrarIncidenciaDto {
  @IsUUID()
  puntoRutaEjecucionId: string;

  @IsUUID()
  tipoIncidenciaId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  descripcion?: string;

  @IsEnum(PrioridadIncidenciaEnum)
  prioridad: PrioridadIncidenciaEnum;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud: number;
}
