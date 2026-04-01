import { Controller, Get, Post, Body, Patch, Param, Delete, ParseUUIDPipe } from '@nestjs/common';

import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto, UpdateUsuarioDto } from './dto';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Usuario } from 'src/common/entities';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { RolesValidosEnum } from 'src/common/enums';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  @Auth(RolesValidosEnum.ADMIN)
  create(
    @Body() createUsuarioDto: CreateUsuarioDto,
    @GetUser() user: Usuario,
  ) {
    return this.usuariosService.create(createUsuarioDto, user);
  }

  @Get()
  @Auth()
  findAll() {
    return this.usuariosService.findAll();
  }
  
  @Get('/getMe')
  @Auth()
  getMe(
    @GetUser() user: Usuario,
  ) {
    return this.usuariosService.findOne(user.id);
  }

  @Get('roles')
  @Auth()
  findAllRoles() {
    return this.usuariosService.findAllRoles();
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usuariosService.findOne(id);
  }

  @Patch('habilitar/:id',)
  @Auth(RolesValidosEnum.ADMIN)
  habilitar(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: Usuario,
  ) {
    return this.usuariosService.rehabilitar(id, user);
  }
  
  @Patch(':id')
  @Auth(RolesValidosEnum.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string, 
    @Body() updateUsuarioDto: UpdateUsuarioDto,
    @GetUser() user: Usuario,
  ) {
    return this.usuariosService.update(id, updateUsuarioDto, user);
  }
  
  @Delete(':id')
  @Auth(RolesValidosEnum.ADMIN)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @GetUser() user: Usuario,
  ) {
    return this.usuariosService.remove(id, user);
  }
}
