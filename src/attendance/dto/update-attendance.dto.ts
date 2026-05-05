import {
  ArrayUnique,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateAttendanceDto {
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  shiftIds: string[];

  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;
}
