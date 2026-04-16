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
import { TipoPuntoColeccionEnum } from 'src/common/enums';

export class CreatePuntoRecoleccionDto {
  @IsUUID()
  zonaId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  direccion: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  referencia?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud: number;

  @IsEnum(TipoPuntoColeccionEnum)
  @IsOptional()
  tipoPunto?: TipoPuntoColeccionEnum;

  @IsNumber()
  @IsOptional()
  @Min(0)
  @Max(32767)
  prioridad?: number;
}
