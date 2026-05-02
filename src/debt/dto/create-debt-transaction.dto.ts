import { ArrayMinSize, IsDateString, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';
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

  @ValidateNested({ each: true })
  @Type(() => CreateTransactionItemDto)
  @ArrayMinSize(1)
  items: CreateTransactionItemDto[];
}
