import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditoriaLog, Vehiculo } from 'src/common/entities';
import { AuthModule } from 'src/auth/auth.module';
import { VehiculosService } from './vehiculos.service';
import { VehiculosController } from './vehiculos.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehiculo, AuditoriaLog]),
    AuthModule,
  ],
  controllers: [VehiculosController],
  providers: [VehiculosService],
})
export class VehiculosModule {}
