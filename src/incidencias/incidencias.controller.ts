import { Body, Controller, Get, Param, ParseUUIDPipe, Patch } from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Usuario } from 'src/common/entities';
import { RolesValidosEnum } from 'src/common/enums';
import { ResolverIncidenciaDto } from './dto/resolver-incidencia.dto';
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

  @Patch(':id/resolver')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  resolver(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolverIncidenciaDto,
    @GetUser() user: Usuario,
  ) {
    return this.incidenciasService.resolver(id, dto, user);
  }
}
