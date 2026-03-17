import { IsArray, IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateUsuarioDto {
  @IsString()
  @MinLength(1)
  nombre: string;

  @IsString()
  @MinLength(1)
  apellidoPaterno: string;

  @IsString()
  @MinLength(1)
  apellidoMaterno: string;

  @IsString()
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(50)
  @Matches(
    /(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/,
    {
      message:
        'La contraseña debe tener mayúsculas, minúsculas y un número o caracter especial',
    },
  )
  password: string;

  @IsString()
  @IsOptional()
  @MinLength(8)
  phone?: string;

  @IsArray()
  @IsUUID(undefined, { each: true })
  rolesIds: string[];
}
