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
import { ZonasService } from './zonas.service';
import { CreateZonaDto } from './dto/create-zona.dto';
import { UpdateZonaDto } from './dto/update-zona.dto';

@Controller('zonas')
export class ZonasController {
  constructor(private readonly zonasService: ZonasService) {}

  @Post()
  @Auth(RolesValidosEnum.ADMIN, RolesValidosEnum.PLANIFICADOR, RolesValidosEnum.SUPERVISOR)
  create(
    @Body() createZonaDto: CreateZonaDto,
    @GetUser() user: Usuario,
  ) {
    return this.zonasService.create(createZonaDto, user);
  }

  @Get()
  findAll() {
    return this.zonasService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.zonasService.findOne(id);
  }

  @Patch('rehabilitar/:id')
  @Auth(RolesValidosEnum.ADMIN, RolesValidosEnum.PLANIFICADOR, RolesValidosEnum.SUPERVISOR)
  rehabilitar(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: Usuario,
  ) {
    return this.zonasService.rehabilitar(id, user);
  }

  @Patch(':id')
  @Auth(RolesValidosEnum.ADMIN, RolesValidosEnum.PLANIFICADOR, RolesValidosEnum.SUPERVISOR)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateZonaDto: UpdateZonaDto,
    @GetUser() user: Usuario,
  ) {
    return this.zonasService.update(id, updateZonaDto, user);
  }

  @Delete(':id')
  @Auth(RolesValidosEnum.ADMIN, RolesValidosEnum.PLANIFICADOR, RolesValidosEnum.SUPERVISOR)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: Usuario,
  ) {
    return this.zonasService.remove(id, user);
  }
}
