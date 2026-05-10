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
import { CreateRutaDto } from './dto/create-ruta.dto';
import { UpdateRutaDto } from './dto/update-ruta.dto';
import { RutasService } from './rutas.service';

@Controller('rutas')
export class RutasController {
  constructor(private readonly rutasService: RutasService) {}

  @Post()
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  create(@Body() createDto: CreateRutaDto, @GetUser() user: Usuario) {
    return this.rutasService.create(createDto, user);
  }

  @Get()
  findAll(
    @Query('incluirInactivos', new DefaultValuePipe(false), ParseBoolPipe)
    incluirInactivos: boolean,
    @Query('conPuntos', new DefaultValuePipe(true), ParseBoolPipe)
    conPuntos: boolean,
  ) {
    return this.rutasService.findAll(incluirInactivos, conPuntos);
  }

  @Get('asignadas')
  @Auth(
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  findRutasAsignadas(
    @Query('conductorId') conductorId: string | undefined,
    @Query('planificadorId') planificadorId: string | undefined,
    @Query('supervisorId') supervisorId: string | undefined,
    @GetUser() user: Usuario,
  ) {
    return this.rutasService.findRutasAsignadas(
      { conductorId, planificadorId, supervisorId },
      user,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.rutasService.findOne(id);
  }

  @Patch('rehabilitar/:id')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  rehabilitar(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: Usuario,
  ) {
    return this.rutasService.rehabilitar(id, user);
  }

  @Patch(':id')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateRutaDto,
    @GetUser() user: Usuario,
  ) {
    return this.rutasService.update(id, updateDto, user);
  }

  @Delete(':id')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  remove(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: Usuario) {
    return this.rutasService.remove(id, user);
  }
}
