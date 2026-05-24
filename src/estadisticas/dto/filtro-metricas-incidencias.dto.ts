import { IsDateString, IsOptional } from 'class-validator';

export class FiltroMetricasIncidenciasDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;
}
