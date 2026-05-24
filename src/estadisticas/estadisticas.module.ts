import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { EjecucionRuta, Incidencia, PuntoRutaEjecucion } from 'src/common/entities';
import { EstadisticasController } from './estadisticas.controller';
import { EstadisticasService } from './estadisticas.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    EjecucionRuta, 
    Incidencia,
    PuntoRutaEjecucion,
  ]), AuthModule],
  controllers: [EstadisticasController],
  providers: [EstadisticasService],
  exports: [EstadisticasService],
})
export class EstadisticasModule {}
