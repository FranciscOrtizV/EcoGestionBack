import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import {
  AsignacionRuta,
  AuditoriaLog,
  EjecucionRuta,
  Evidencia,
  Incidencia,
  TipoIncidencia,
  PuntoRuta,
  PuntoRutaEjecucion,
  Ruta,
  Usuario,
  Vehiculo,
} from 'src/common/entities';
import { ArchivosService } from './archivos.service';
import { EjecucionRutasController } from './ejecucion_rutas.controller';
import { EjecucionRutasService } from './ejecucion_rutas.service';


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
      Incidencia,
      TipoIncidencia,
    ]),
    AuthModule,
  ],
  controllers: [EjecucionRutasController],
  providers: [EjecucionRutasService, ArchivosService],
})
export class EjecucionRutasModule {}
