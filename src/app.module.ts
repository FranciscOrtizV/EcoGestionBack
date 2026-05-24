import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import * as entidades from './common/entities';
import { AuthModule } from './auth/auth.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { VehiculosModule } from './vehiculos/vehiculos.module';
import { TiposIncidenciasModule } from './tipos_incidencias/tipos_incidencias.module';
import { ZonasModule } from './zonas/zonas.module';
import { PuntosRecoleccionModule } from './puntos_recoleccion/puntos-recoleccion.module';
import { RutasModule } from './rutas/rutas.module';
import { AsignacionRutasModule } from './asignacion_rutas/asignacion-rutas.module';
import { EjecucionRutasModule } from './ejecucion_rutas/ejecucion_rutas.module';
import { IncidenciasModule } from './incidencias/incidencias.module';


@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: +process.env.DB_PORT!,
      database: process.env.DB_NAME,
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      autoLoadEntities: true,
      entities: entidades
      // synchronize: true,
    }),
    AuthModule,
    UsuariosModule,
    VehiculosModule,
    TiposIncidenciasModule,
    ZonasModule,
    PuntosRecoleccionModule,
    RutasModule,
    AsignacionRutasModule,
    EjecucionRutasModule,
    IncidenciasModule,
  ],
})
export class AppModule {}
