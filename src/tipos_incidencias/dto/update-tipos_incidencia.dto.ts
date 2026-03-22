import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTiposIncidenciaDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nombre?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  descripcion?: string;
}
