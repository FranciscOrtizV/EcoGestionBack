import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { AuditoriaLog, TipoIncidencia } from 'src/common/entities';
import { TiposIncidenciasService } from './tipos_incidencias.service';
import { TiposIncidenciasController } from './tipos_incidencias.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TipoIncidencia, AuditoriaLog]),
    AuthModule,
  ],
  controllers: [TiposIncidenciasController],
  providers: [TiposIncidenciasService],
})
export class TiposIncidenciasModule {}
