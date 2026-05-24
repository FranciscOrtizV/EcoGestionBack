import { IsNumber, Max, Min } from 'class-validator';

export class FinalizarEjecucionRutaDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitudFin: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitudFin: number;

  @IsNumber()
  @Min(0)
  odometroFin: number;
}
