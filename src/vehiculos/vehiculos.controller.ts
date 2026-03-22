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
import { VehiculosService } from './vehiculos.service';
import { CreateVehiculoDto } from './dto/create-vehiculo.dto';
import { UpdateVehiculoDto } from './dto/update-vehiculo.dto';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Usuario } from 'src/common/entities';
import { RolesValidosEnum } from 'src/common/enums';

@Controller('vehiculos')
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) {}

  @Post()
  @Auth(RolesValidosEnum.ADMIN)
  create(
    @Body() createVehiculoDto: CreateVehiculoDto,
    @GetUser() user: Usuario,
  ) {
    return this.vehiculosService.create(createVehiculoDto, user);
  }

  @Get()
  findAll() {
    return this.vehiculosService.findAll();
  }

  @Get(':identificador')
  findOne(@Param('identificador') identificador: string) {
    return this.vehiculosService.findOne(identificador);
  }

  @Patch('rehabilitar/:id')
  @Auth(RolesValidosEnum.ADMIN)
  rehabilitar(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: Usuario,
  ) {
    return this.vehiculosService.rehabilitar(id, user);
  }

  @Patch(':id')
  @Auth(RolesValidosEnum.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateVehiculoDto: UpdateVehiculoDto,
    @GetUser() user: Usuario,
  ) {
    return this.vehiculosService.update(id, updateVehiculoDto, user);
  }

  @Delete(':id')
  @Auth(RolesValidosEnum.ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: Usuario,
  ) {
    return this.vehiculosService.remove(id, user);
  }
}
