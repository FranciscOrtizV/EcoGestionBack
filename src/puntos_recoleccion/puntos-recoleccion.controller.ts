import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Usuario } from 'src/common/entities';
import { RolesValidosEnum } from 'src/common/enums';
import { CreatePuntoRecoleccionDto } from './dto/create-punto-recoleccion.dto';
import { UpdatePuntoRecoleccionDto } from './dto/update-punto-recoleccion.dto';
import { PuntosRecoleccionService } from './puntos-recoleccion.service';

@Controller('puntos-recoleccion')
export class PuntosRecoleccionController {
  constructor(private readonly puntosRecoleccionService: PuntosRecoleccionService) {}

  @Post()
  @Auth(RolesValidosEnum.ADMIN, RolesValidosEnum.PLANIFICADOR, RolesValidosEnum.SUPERVISOR)
  create(
    @Body() createDto: CreatePuntoRecoleccionDto,
    @GetUser() user: Usuario,
  ) {
    return this.puntosRecoleccionService.create(createDto, user);
  }

  @Get()
  findAll(
    @Query('incluirInactivos', new DefaultValuePipe(false), ParseBoolPipe)
    incluirInactivos: boolean,
  ) {
    return this.puntosRecoleccionService.findAll(incluirInactivos);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.puntosRecoleccionService.findOne(id);
  }

  @Patch('rehabilitar/:id')
  @Auth(RolesValidosEnum.ADMIN, RolesValidosEnum.PLANIFICADOR, RolesValidosEnum.SUPERVISOR)
  rehabilitar(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: Usuario,
  ) {
    return this.puntosRecoleccionService.rehabilitar(id, user);
  }

  @Patch(':id')
  @Auth(RolesValidosEnum.ADMIN, RolesValidosEnum.PLANIFICADOR, RolesValidosEnum.SUPERVISOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdatePuntoRecoleccionDto,
    @GetUser() user: Usuario,
  ) {
    return this.puntosRecoleccionService.update(id, updateDto, user);
  }

  @Delete(':id')
  @Auth(RolesValidosEnum.ADMIN, RolesValidosEnum.PLANIFICADOR, RolesValidosEnum.SUPERVISOR)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: Usuario,
  ) {
    return this.puntosRecoleccionService.remove(id, user);
  }
}
