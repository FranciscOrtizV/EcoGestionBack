import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { EstadoVehiculoEnum } from 'src/common/enums';

export class CreateVehiculoDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(20)
  patente: string;

  @IsString()
  @IsOptional()
  @MaxLength(50)
  codigoInterno?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  marca?: string;

  @IsString()
  @IsOptional()
  @MaxLength(100)
  modelo?: string;

  @IsInt()
  @IsOptional()
  @Min(1900)
  @Max(new Date().getFullYear() + 1)
  anioVehiculo?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  capacidadKg?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  capacidadM3?: number;

  @IsEnum(EstadoVehiculoEnum)
  @IsOptional()
  estado?: EstadoVehiculoEnum;
}
