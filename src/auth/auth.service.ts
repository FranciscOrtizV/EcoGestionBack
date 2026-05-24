import { BadRequestException, HttpStatus, Injectable, InternalServerErrorException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DataSource, Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';

import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { Rol, Usuario, UsuarioRol } from 'src/common/entities';
import { buildResponse } from 'src/common/helpers/index';

@Injectable()
export class AuthService {

  constructor(

    @InjectRepository(Usuario)
    private readonly userRepository: Repository<Usuario>,

    @InjectRepository(Rol)
    private readonly rolRepository: Repository<Rol>,

    @InjectRepository(UsuarioRol)
    private readonly usuarioRolRepository: Repository<UsuarioRol>,

    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,

    private readonly dataSource: DataSource,
    
  ){}

  async create(createUserDto: CreateUserDto) {

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      
      const { password, idRol, ...userDto } = createUserDto;
      
      // 1. Verificar si existe un usuario con el mismo email
      const usuario = await this.userRepository.findOneBy({ email: userDto.email });
      if( usuario ){
        return buildResponse(HttpStatus.CONFLICT, `Ya existe un usuario registrado en el sistema con el email: ${userDto.email}.`);
      }
      
      // 2. Verificar si existe el rol a asignar
      const rol = await this.rolRepository.findOneBy({ id: idRol });
      if( !rol ){
        return buildResponse(HttpStatus.NOT_FOUND, `No se encontró un rol con id: ${idRol}`);
      }
      
      // 3. Crear usuario encriptando la contraseña
      const newUser = this.userRepository.create({
        ...userDto,
        password: bcrypt.hashSync( password, 10 ),
        createdAt: new Date(),
      });
      await queryRunner.manager.save(newUser);
      
      
      // 4. Crear registro en al tabla usuario_rol
      const relacion = this.usuarioRolRepository.create({
        usuario: newUser,
        rol: rol,
        createdAt: new Date()
      })
      await queryRunner.manager.save(relacion);

      await queryRunner.commitTransaction(); // Comitear cambios a la BD
      await queryRunner.release(); // Desconectar el query Runner
      
      // 5. Retornar respuesta
      // Para evitar retornar la contraseña
      const { password: pass, ...userInfo } = newUser;
      return buildResponse(HttpStatus.CREATED, "Usuario creado correctamente", userInfo);

    } catch (error) {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
      this.handleDbErrors(error);
    }
  }

  async loginUser(loginUserDto: LoginUserDto) {

    const { email, password } = loginUserDto;

    const user = await this.userRepository.findOne({
      where: { email },
      select: { email: true, password: true, id: true }
    })

    if( !user )
      throw new UnauthorizedException('Credenciales invalidas');
    
    if( !bcrypt.compareSync(password, user.password) )
      throw new UnauthorizedException('Credenciales invalidas');

    const payload: JwtPayload = { id: user.id };

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    const { password: _pass, ...userWithoutPassword } = user;

    return {
      accessToken: this.getAccessToken(payload),
      refreshToken: this.getRefreshToken(payload),
    };

  }

  async refreshTokens(refreshToken: string) {
    try {
      const decoded = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_SECRET'),
      }) as JwtPayload;

      const user = await this.userRepository.findOne({
        where: { id: decoded.id },
      });

      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      const payload: JwtPayload = { id: user.id };

      return {
        accessToken: this.getAccessToken(payload),
        refreshToken: this.getRefreshToken(payload),
      };
    } catch (error) {
      throw new UnauthorizedException('Refresh token inválido o expirado');
    }
  }

  private getAccessToken(payload: JwtPayload){
    const expiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES') || '3h';
    return this.jwtService.sign(payload as any, { expiresIn } as any);
  }

  private getRefreshToken(payload: JwtPayload){
    const expiresIn = this.configService.get<string>('JWT_REFRESH_EXPIRES') || '4h';
    return this.jwtService.sign(payload as any, { expiresIn } as any);
  }


  private handleDbErrors( error: any ): never {
    if( error.code === '23505' )
      throw new BadRequestException(error.detail);

    console.log(error);

    throw new InternalServerErrorException('Please check server logs');
  }

}
