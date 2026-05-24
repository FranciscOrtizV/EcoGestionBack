import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { RolesValidosEnum } from 'src/common/enums';
import { IncidenciasService } from './incidencias.service';

@Controller('incidencias')
export class IncidenciasController {
  constructor(private readonly incidenciasService: IncidenciasService) {}

  @Get('getAll')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  findAll() {
    return this.incidenciasService.findAll();
  }

  @Get(':id')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.incidenciasService.findOne(id);
  }
}
