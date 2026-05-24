import {
  BadRequestException,
  Body,
  Controller,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Auth } from 'src/auth/decorators/auth.decorator';
import { GetUser } from 'src/auth/decorators/get-user.decorator';
import { Usuario } from 'src/common/entities';
import { RolesValidosEnum } from 'src/common/enums';
import { ActualizarEstadoPuntoEjecucionDto } from './dto/actualizar-estado-punto-ejecucion.dto';
import { IniciarEjecucionRutaDto } from './dto/iniciar-ejecucion-ruta.dto';
import { RegistrarIncidenciaDto } from './dto/registrar-incidencia.dto';
import { EjecucionRutasService } from './ejecucion_rutas.service';

const MAX_FOTO_BYTES = 5 * 1024 * 1024;
const TIPOS_IMAGEN_PERMITIDOS = /^image\/(jpeg|png|webp)$/;

@Controller('ejecucion-rutas')
export class EjecucionRutasController {
  constructor(private readonly ejecucionRutasService: EjecucionRutasService) {}

  @Post('incidencias')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  @UseInterceptors(
    FileInterceptor('fotografia', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FOTO_BYTES },
    }),
  )
  registrarIncidencia(
    @Body() dto: RegistrarIncidenciaDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [new MaxFileSizeValidator({ maxSize: MAX_FOTO_BYTES })],
      }),
    )
    fotografia: Express.Multer.File | undefined,
    @GetUser() user: Usuario,
  ) {
    if (fotografia && !TIPOS_IMAGEN_PERMITIDOS.test(fotografia.mimetype)) {
      throw new BadRequestException(
        'La fotografía debe ser JPEG, PNG o WebP.',
      );
    }

    return this.ejecucionRutasService.registrarIncidencia(
      dto,
      fotografia,
      user,
    );
  }

  @Patch('puntos/estado')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  @UseInterceptors(
    FileInterceptor('fotografia', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FOTO_BYTES },
    }),
  )
  actualizarEstadoPunto(
    @Body() dto: ActualizarEstadoPuntoEjecucionDto,
    @UploadedFile(
      new ParseFilePipe({
        fileIsRequired: false,
        validators: [new MaxFileSizeValidator({ maxSize: MAX_FOTO_BYTES })],
      }),
    )
    fotografia: Express.Multer.File | undefined,
    @GetUser() user: Usuario,
  ) {
    if (fotografia && !TIPOS_IMAGEN_PERMITIDOS.test(fotografia.mimetype)) {
      throw new BadRequestException(
        'La fotografía debe ser JPEG, PNG o WebP.',
      );
    }

    return this.ejecucionRutasService.actualizarEstadoPunto(
      dto,
      fotografia,
      user,
    );
  }

  @Patch(':id/iniciar')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  iniciar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: IniciarEjecucionRutaDto,
    @GetUser() user: Usuario,
  ) {
    return this.ejecucionRutasService.iniciar(id, dto, user);
  }

  @Get(':id/resumen')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  getResumen(@Param('id', ParseUUIDPipe) id: string) {
    return this.ejecucionRutasService.getResumenPorId(id);
  }

  @Get(':id/puntos')
  @Auth(
    RolesValidosEnum.ADMIN,
    RolesValidosEnum.PLANIFICADOR,
    RolesValidosEnum.SUPERVISOR,
    RolesValidosEnum.CONDUCTOR,
  )
  getPuntos(@Param('id', ParseUUIDPipe) id: string) {
    return this.ejecucionRutasService.getPuntosPorEjecucionId(id);
  }
}
