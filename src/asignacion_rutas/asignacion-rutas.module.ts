import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import {
  AsignacionRuta,
  AuditoriaLog,
  EjecucionRuta,
  Ruta,
  Usuario,
  Vehiculo,
} from 'src/common/entities';
import { AsignacionRutasController } from './asignacion-rutas.controller';
import { AsignacionRutasService } from './asignacion-rutas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AsignacionRuta,
      Ruta,
      Vehiculo,
      Usuario,
      EjecucionRuta,
      AuditoriaLog,
    ]),
    AuthModule,
  ],
  controllers: [AsignacionRutasController],
  providers: [AsignacionRutasService],
})
export class AsignacionRutasModule {}
