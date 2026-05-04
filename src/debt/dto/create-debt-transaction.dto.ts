import {
  ArrayMinSize,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateTransactionItemDto } from './create-transaction-item.dto';

export class CreateDebtTransactionDto {
  @IsUUID()
  customerId: string;

  @IsOptional()
  @IsDateString()
  transactionDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  prepaidAmount?: number;

  @ValidateNested({ each: true })
  @Type(() => CreateTransactionItemDto)
  @ArrayMinSize(1)
  items: CreateTransactionItemDto[];
}
