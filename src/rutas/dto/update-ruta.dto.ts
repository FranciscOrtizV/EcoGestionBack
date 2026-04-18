import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PuntoRutaLineaDto } from './punto-ruta-linea.dto';

export class UpdateRutaDto {
  @IsString()
  @IsOptional()
  @MaxLength(150)
  nombre?: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  codigo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  descripcion?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  tipoRuta?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimacionDuracionMinutos?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PuntoRutaLineaDto)
  puntos?: PuntoRutaLineaDto[];
}
