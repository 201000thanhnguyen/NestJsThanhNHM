import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePaymentAdjustmentDto {
  @Type(() => Number)
  @IsNumber({}, { message: 'Số điều chỉnh không hợp lệ' })
  amountAdjustment: number;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}
