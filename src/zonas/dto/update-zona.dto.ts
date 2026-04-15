import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateZonaDto {
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
}
