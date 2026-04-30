import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import type { TransactionType } from '../transaction.entity';

const TRANSACTION_TYPES = [
  'attendance',
  'bonus',
  'advance',
  'penalty',
  'payment',
] as const;

export class CreateTransactionDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date: string;

  @IsInt()
  amount: number;

  @IsString()
  @IsIn(TRANSACTION_TYPES)
  type: TransactionType;

  @ValidateIf((_, value) => value !== null && value !== undefined)
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  @MaxLength(7)
  period?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
