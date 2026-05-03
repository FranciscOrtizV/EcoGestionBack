import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { AuditoriaLog, PuntoRecoleccion, PuntoRuta, Ruta } from 'src/common/entities';
import { RutasController } from './rutas.controller';
import { RutasService } from './rutas.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ruta, PuntoRuta, PuntoRecoleccion, AuditoriaLog]),
    AuthModule,
  ],
  controllers: [RutasController],
  providers: [RutasService],
})
export class RutasModule {}
