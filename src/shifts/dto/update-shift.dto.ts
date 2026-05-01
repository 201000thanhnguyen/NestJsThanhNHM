import { IsMilitaryTime, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateShiftDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsMilitaryTime()
  startTime?: string;

  @IsOptional()
  @IsMilitaryTime()
  endTime?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  salary?: number;
}

