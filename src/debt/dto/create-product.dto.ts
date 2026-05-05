import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  name: string;

  @IsNumber()
  @Min(0)
  defaultPrice: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
