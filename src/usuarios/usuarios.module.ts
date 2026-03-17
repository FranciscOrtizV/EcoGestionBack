import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaLog, Rol, Usuario, UsuarioRol } from 'src/common/entities';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService],
  imports: [
    TypeOrmModule.forFeature([Usuario, Rol, UsuarioRol, AuditoriaLog]),
    AuthModule,
  ],
  exports: [
    UsuariosService,
    TypeOrmModule
  ]
})
export class UsuariosModule {}
