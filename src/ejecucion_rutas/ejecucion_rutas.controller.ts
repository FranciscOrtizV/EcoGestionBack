import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { RolesValidosEnum } from 'src/common/enums';
import { EjecucionRutasService } from './ejecucion_rutas.service';

@Controller('ejecucion-rutas')
export class EjecucionRutasController {
  constructor(private readonly ejecucionRutasService: EjecucionRutasService) {}

  @Get(':id/resumen')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  getResumen(@Param('id', ParseUUIDPipe) id: string) {
    return this.ejecucionRutasService.getResumenPorId(id);
  }

  @Get(':id/puntos')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  getPuntos(@Param('id', ParseUUIDPipe) id: string) {
    return this.ejecucionRutasService.getPuntosPorEjecucionId(id);
  }
}
