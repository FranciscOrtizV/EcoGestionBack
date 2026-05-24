import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import {
  AsignacionRuta,
  AuditoriaLog,
  EjecucionRuta,
  Evidencia,
  Incidencia,
  PuntoRuta,
  PuntoRutaEjecucion,
  Ruta,
  Usuario,
  Vehiculo,
} from 'src/common/entities';
import { EjecucionRutasService } from './ejecucion_rutas.service';
import { EjecucionRutasController } from './ejecucion_rutas.controller';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      AsignacionRuta,
      Ruta,
      Vehiculo,
      Usuario,
      EjecucionRuta,
      AuditoriaLog,
      PuntoRuta,
      PuntoRutaEjecucion,
      Evidencia,
      Incidencia
    ]),
    AuthModule,
  ],
  controllers: [EjecucionRutasController],
  providers: [EjecucionRutasService],
})
export class EjecucionRutasModule {}
