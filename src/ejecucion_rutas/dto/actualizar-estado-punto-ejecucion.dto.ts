import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { EstadoEjecucionPuntoRutaEnum } from 'src/common/enums';

export class ActualizarEstadoPuntoEjecucionDto {
  @IsUUID()
  puntoRutaEjecucionId: string;

  @IsEnum(EstadoEjecucionPuntoRutaEnum)
  estado: EstadoEjecucionPuntoRutaEnum;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  comentarios?: string;
}
