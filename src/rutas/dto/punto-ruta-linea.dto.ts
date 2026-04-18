import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';

export class PuntoRutaLineaDto {
  @IsUUID()
  puntoRecoleccionId: string;

  @IsInt()
  @Min(1)
  ordenSecuencia: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  estimacionParadaMinutos?: number;
}
