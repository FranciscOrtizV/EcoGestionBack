import { IsDateString, IsOptional } from 'class-validator';

export class FiltroMetricasPuntosRetiroDto {
  @IsOptional()
  @IsDateString()
  desde?: string;

  @IsOptional()
  @IsDateString()
  hasta?: string;
}
