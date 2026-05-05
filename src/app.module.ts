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
import { AuthModule } from './auth/auth.module';
import { Quote } from './quotes/quote.entity';
import { QuotesModule } from './quotes/quotes.module';
import { DebtModule } from './debt/debt.module';
import { DebtCustomer } from './debt/entities/customer.entity';
import { DebtSnapshot } from './debt/entities/debt-snapshot.entity';
import { DebtPaymentAdjustment } from './debt/entities/payment-adjustment.entity';
import { DebtPaymentAllocation } from './debt/entities/payment-allocation.entity';
import { DebtPayment } from './debt/entities/payment.entity';
import { DebtProduct } from './debt/entities/product.entity';
import { DebtTransactionItem } from './debt/entities/transaction-item.entity';
import { DebtTransaction } from './debt/entities/transaction.entity';
import { ImageModule } from './template/upload/image.module';
import { ImageEntity } from './template/upload/image.entity';

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
        Quote,
        DebtCustomer,
        DebtProduct,
        DebtTransaction,
        DebtTransactionItem,
        DebtPayment,
        DebtPaymentAllocation,
        DebtPaymentAdjustment,
        DebtSnapshot,
        ImageEntity,
      ],
      synchronize: true,
    }),
    CatsModule,
    ShiftsModule,
    AttendanceModule,
    TransactionsModule,
    AuthModule,
    QuotesModule,
    DebtModule,
    ImageModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
