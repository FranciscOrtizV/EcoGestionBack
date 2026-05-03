import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { AuditoriaLog, PuntoRecoleccion, Zona } from 'src/common/entities';
import { PuntosRecoleccionController } from './puntos-recoleccion.controller';
import { PuntosRecoleccionService } from './puntos-recoleccion.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PuntoRecoleccion, Zona, AuditoriaLog]),
    AuthModule,
  ],
  controllers: [PuntosRecoleccionController],
  providers: [PuntosRecoleccionService],
})
export class PuntosRecoleccionModule {}
