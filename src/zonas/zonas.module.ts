import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { AuditoriaLog, Zona } from 'src/common/entities';
import { ZonasService } from './zonas.service';
import { ZonasController } from './zonas.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Zona, AuditoriaLog]),
    AuthModule,
  ],
  controllers: [ZonasController],
  providers: [ZonasService],
})
export class ZonasModule {}
