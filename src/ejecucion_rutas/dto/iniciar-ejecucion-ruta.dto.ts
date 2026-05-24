import { IsNumber, Max, Min } from 'class-validator';

export class IniciarEjecucionRutaDto {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitudInicio: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitudInicio: number;

  @IsNumber()
  @Min(0)
  odometroInicio: number;
}
