import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { EstadoIncidenciaEnum } from 'src/common/enums';

export class ResolverIncidenciaDto {
  @IsEnum(EstadoIncidenciaEnum)
  estado: EstadoIncidenciaEnum;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  comentarioResolucion: string;
}
