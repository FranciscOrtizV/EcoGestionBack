import { IsArray, IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateUsuarioDto {
  @IsString()
  @IsOptional()
  @MinLength(1)
  nombre?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  apellidoPaterno?: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  apellidoMaterno?: string;

  @IsString()
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @IsOptional()
  @MinLength(6)
  @MaxLength(50)
  @Matches(
    /(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/,
    {
      message:
        'La contraseña debe tener mayúsculas, minúsculas y un número o caracter especial',
    },
  )
  password?: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  phone?: string;

  @IsArray()
  @IsOptional()
  @IsUUID(undefined, { each: true })
  rolesIds?: string[];
}