import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './transaction.entity';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { Attendance } from '../attendance/attendance.entity';
import { Shift } from '../shifts/shift.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, Attendance, Shift])],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
