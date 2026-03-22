import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Usuario } from 'src/common/entities';
import { RolesValidosEnum } from 'src/common/enums';
import { TiposIncidenciasService } from './tipos_incidencias.service';
import { CreateTiposIncidenciaDto } from './dto/create-tipos_incidencia.dto';
import { UpdateTiposIncidenciaDto } from './dto/update-tipos_incidencia.dto';

@Controller('tipos-incidencias')
export class TiposIncidenciasController {
  constructor(private readonly tiposIncidenciasService: TiposIncidenciasService) {}

  @Post()
  @Auth(RolesValidosEnum.ADMIN)
  create(
    @Body() createTiposIncidenciaDto: CreateTiposIncidenciaDto,
    @GetUser() user: Usuario,
  ) {
    return this.tiposIncidenciasService.create(createTiposIncidenciaDto, user);
  }

  @Get()
  findAll() {
    return this.tiposIncidenciasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tiposIncidenciasService.findOne(id);
  }

  @Patch('rehabilitar/:id')
  @Auth(RolesValidosEnum.ADMIN)
  rehabilitar(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: Usuario,
  ) {
    return this.tiposIncidenciasService.rehabilitar(id, user);
  }

  @Patch(':id')
  @Auth(RolesValidosEnum.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateTiposIncidenciaDto: UpdateTiposIncidenciaDto,
    @GetUser() user: Usuario,
  ) {
    return this.tiposIncidenciasService.update(id, updateTiposIncidenciaDto, user);
  }

  @Delete(':id')
  @Auth(RolesValidosEnum.ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: Usuario,
  ) {
    return this.tiposIncidenciasService.remove(id, user);
  }
}
