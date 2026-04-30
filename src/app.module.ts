import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatsModule } from './cats/cats.module';
import { Cat } from './cats/cat.entity';
import { Shift } from './shifts/shift.entity';
import { ShiftsModule } from './shifts/shifts.module';
import { Attendance } from './attendance/attendance.entity';
import { AttendanceModule } from './attendance/attendance.module';
import { Transaction } from './transactions/transaction.entity';
import { TransactionsModule } from './transactions/transactions.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASS ?? 'root',
      database: process.env.DB_NAME ?? 'test',
      entities: [
        Cat,
        Shift,
        Attendance,
        Transaction,
      ],
      synchronize: true,
    }),
    CatsModule,
    ShiftsModule,
    AttendanceModule,
    TransactionsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
