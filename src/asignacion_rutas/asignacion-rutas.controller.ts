import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Usuario } from 'src/common/entities';
import { EstadoAsignacionRutaEnum, RolesValidosEnum } from 'src/common/enums';
import { AsignacionRutasService } from './asignacion-rutas.service';
import { CreateAsignacionRutaDto } from './dto/create-asignacion-ruta.dto';
import { FindAsignacionesRangoFechaDto } from './dto/find-asignaciones-rango-fecha.dto';
import { UpdateAsignacionRutaDto } from './dto/update-asignacion-ruta.dto';

@Controller('asignacion-rutas')
export class AsignacionRutasController {
  constructor(private readonly asignacionRutasService: AsignacionRutasService) {}

  @Post()
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  create(
    @Body() createDto: CreateAsignacionRutaDto,
    @GetUser() user: Usuario,
  ) {
    const { conductorId, planificadorId, supervisorId } = createDto;
    const payload = {
      ...createDto,
      estado: EstadoAsignacionRutaEnum.BORRADOR,
    };

    if (
      conductorId === planificadorId ||
      (supervisorId != null &&
        (supervisorId === conductorId || supervisorId === planificadorId))
    ) {
      throw new BadRequestException(
        'conductorId, planificadorId y supervisorId deben ser usuarios distintos.',
      );
    }

    return this.asignacionRutasService.create(payload, user);
  }

  @Get()
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  findAll() {
    return this.asignacionRutasService.findAll();
  }

  @Get('rango-fechas')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  findByDateRange(@Query() query: FindAsignacionesRangoFechaDto) {
    return this.asignacionRutasService.findByDateRange(
      query.fechaInicio,
      query.fechaFin,
    );
  }

  @Get(':id')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.asignacionRutasService.findOne(id);
  }

  @Patch(':id/inicio')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  inicio(@Param('id', ParseUUIDPipe) id: string, @GetUser() user: Usuario) {
    return this.asignacionRutasService.inicio(id, user);
  }

  @Patch(':id/publicar')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  publicarAsignacion(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: Usuario,
  ) {
    return this.asignacionRutasService.publicarAsignacion(id, user);
  }

  @Patch(':id')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
  )
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateAsignacionRutaDto,
    @GetUser() user: Usuario,
  ) {
    return this.asignacionRutasService.update(id, updateDto, user);
  }
}
