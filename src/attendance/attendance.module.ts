import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from './attendance.entity';
import { AttendanceController } from './attendance.controller';
import { AttendanceService } from './attendance.service';
import { Shift } from '../shifts/shift.entity';
import { Transaction } from '../transactions/transaction.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Attendance, Shift, Transaction])],
  controllers: [AttendanceController],
  providers: [AttendanceService],
})
export class AttendanceModule {}
