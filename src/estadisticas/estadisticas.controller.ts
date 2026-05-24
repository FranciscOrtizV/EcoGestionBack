import { Controller, Get, Query } from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { RolesValidosEnum } from 'src/common/enums';
import { FiltroMetricasIncidenciasDto } from './dto/filtro-metricas-incidencias.dto';
import { FiltroMetricasPuntosRetiroDto } from './dto/filtro-metricas-puntos-retiro.dto';
import { FiltroMetricasRutasDto } from './dto/filtro-metricas-rutas.dto';
import { EstadisticasService } from './estadisticas.service';

@Controller('estadisticas')
export class EstadisticasController {
  constructor(private readonly estadisticasService: EstadisticasService) {}

  @Get('rutas')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  obtenerMetricasRutas(@Query() query: FiltroMetricasRutasDto) {
    return this.estadisticasService.obtenerMetricasRutas(query);
  }

  @Get('incidencias')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  obtenerMetricasIncidencias(@Query() query: FiltroMetricasIncidenciasDto) {
    return this.estadisticasService.obtenerMetricasIncidencias(query);
  }

  @Get('puntos-retiro')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  obtenerMetricasPuntosRetiro(@Query() query: FiltroMetricasPuntosRetiroDto) {
    return this.estadisticasService.obtenerMetricasPuntosRetiro(query);
  }
}
