import { ArrayUnique, IsArray, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateAttendanceDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  shiftIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
