import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsPositive, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreatePaymentDto {
  @IsUUID()
  customerId: string;

  @Type(() => Number)
  @IsPositive({ message: 'Số tiền phải lớn hơn 0' })
  amount: number;

  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}
