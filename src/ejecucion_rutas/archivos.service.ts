import { BadRequestException, Injectable } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';

const MIME_A_EXTENSION: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export type ArchivoGuardadoDto = {
  fileUrl: string;
  fileName: string;
  mimeType: string;
  fileSizeBytes: number;
  rutaAbsoluta: string;
};

@Injectable()
export class ArchivosService {
  private readonly directorioEvidencias = join(
    process.cwd(),
    'uploads',
    'evidencias',
  );

  async guardarEvidencia(
    archivo: Express.Multer.File,
  ): Promise<ArchivoGuardadoDto> {
    if (!archivo?.buffer?.length) {
      throw new BadRequestException('El archivo de evidencia está vacío.');
    }

    await mkdir(this.directorioEvidencias, { recursive: true });

    const extension =
      extname(archivo.originalname) ||
      MIME_A_EXTENSION[archivo.mimetype] ||
      '';

    const nombreAlmacenado = `${randomUUID()}${extension}`;
    const rutaAbsoluta = join(this.directorioEvidencias, nombreAlmacenado);

    await writeFile(rutaAbsoluta, archivo.buffer);

    return {
      fileUrl: `/uploads/evidencias/${nombreAlmacenado}`,
      fileName: archivo.originalname || nombreAlmacenado,
      mimeType: archivo.mimetype,
      fileSizeBytes: archivo.size,
      rutaAbsoluta,
    };
  }

  async eliminarPorRutaAbsoluta(rutaAbsoluta: string): Promise<void> {
    try {
      await unlink(rutaAbsoluta);
    } catch {
      // Si el archivo ya no existe, no bloquea el flujo.
    }
  }
}
