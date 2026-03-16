import { Controller, Get, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateUserDto } from './dto/create-user.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { GetUser } from './decorators/get-user.decorator';
import { Auth } from './decorators/auth.decorator';
import { Usuario } from 'src/common/entities';
import { RolesValidosEnum } from 'src/common/enums';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  create(@Body() createUserDto: CreateUserDto) {
    return this.authService.create(createUserDto);
  }

  @Post('login')
  loginUser(@Body() loginUser: LoginUserDto) {
    return this.authService.loginUser(loginUser);
  }

  @Post('refresh')
  refresh(
    @Body('refreshToken') refreshToken: string,
  ) {
    return this.authService.refreshTokens(refreshToken);
  }


  //? Este es un ejemplod e como se deben de proteger las rutas del sistema
  // 1. Mediante un token de authenticacion la ruta identifica al usuario
  // 2. En caso de que la ruta tenga roles definidos, se verificará si el usuario obtenido mediante el token tendra acceso a la ruta.
  @Get('testProtected')
  @Auth(RolesValidosEnum.ADMIN, RolesValidosEnum.SUPERVISOR)
  testProtected(
    @GetUser() user: Usuario,
  ){
    return { ok: true, user};
  }

}
