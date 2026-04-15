import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateZonaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nombre: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  codigo?: string;

  @IsString()
  @IsOptional()
  @MaxLength(5000)
  descripcion?: string;
}
