import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateTransactionItemDto {
  @IsOptional()
  @IsUUID()
  productId?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  productNameSnapshot: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  priceSnapshot: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  originalProductPrice?: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}
