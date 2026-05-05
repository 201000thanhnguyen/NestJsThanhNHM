import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QuotesController } from './quotes.controller';
import { Quote } from './quote.entity';
import { QuotesService } from './quotes.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([Quote]), AuthModule],
  controllers: [QuotesController],
  providers: [QuotesService],
})
export class QuotesModule {}
