import { IsEmail, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";

export class CreateUserDto{

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
        /(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, {
        message: 'The password must have a Uppercase, lowercase letter and a number'
    })
    password: string;

    @IsString()
    @MinLength(8)
    phone: string;

    @IsString()
    @IsUUID()
    idRol: string;
    
};