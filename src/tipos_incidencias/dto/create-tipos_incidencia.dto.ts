import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateTiposIncidenciaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  descripcion?: string;
}
