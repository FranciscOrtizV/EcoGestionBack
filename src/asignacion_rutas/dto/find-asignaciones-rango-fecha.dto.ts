import { IsDateString } from 'class-validator';

export class FindAsignacionesRangoFechaDto {
  @IsDateString()
  fechaInicio: string;

  @IsDateString()
  fechaFin: string;
}
