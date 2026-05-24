import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Usuario } from 'src/common/entities';
import { RolesValidosEnum } from 'src/common/enums';
import { IniciarEjecucionRutaDto } from './dto/iniciar-ejecucion-ruta.dto';
import { EjecucionRutasService } from './ejecucion_rutas.service';

@Controller('ejecucion-rutas')
export class EjecucionRutasController {
  constructor(private readonly ejecucionRutasService: EjecucionRutasService) {}

  @Patch(':id/iniciar')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  iniciar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IniciarEjecucionRutaDto,
    @GetUser() user: Usuario,
  ) {
    return this.ejecucionRutasService.iniciar(id, dto, user);
  }

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
