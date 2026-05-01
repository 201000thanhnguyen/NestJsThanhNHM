import { IsOptional, IsString } from 'class-validator';

export class UpdateQuoteDto {
  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  author?: string;
}

