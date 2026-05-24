import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { Evidencia, Incidencia } from 'src/common/entities';
import { IncidenciasController } from './incidencias.controller';
import { IncidenciasService } from './incidencias.service';

@Module({
  imports: [TypeOrmModule.forFeature([
    Incidencia,
    Evidencia
  ]), AuthModule],
  controllers: [IncidenciasController],
  providers: [IncidenciasService],
})
export class IncidenciasModule {}
