import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { DebtController } from './debt.controller';
import { DebtCustomersService } from './debt-customers.service';
import { DebtPaymentsService } from './debt-payments.service';
import { DebtProductsService } from './debt-products.service';
import { DebtReportsService } from './debt-reports.service';
import { DebtSnapshotsService } from './debt-snapshots.service';
import { DebtTransactionsService } from './debt-transactions.service';
import { DebtCustomer } from './entities/customer.entity';
import { DebtSnapshot } from './entities/debt-snapshot.entity';
import { DebtPaymentAdjustment } from './entities/payment-adjustment.entity';
import { DebtPaymentAllocation } from './entities/payment-allocation.entity';
import { DebtPayment } from './entities/payment.entity';
import { DebtProduct } from './entities/product.entity';
import { DebtTransactionItem } from './entities/transaction-item.entity';
import { DebtTransaction } from './entities/transaction.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DebtCustomer,
      DebtProduct,
      DebtTransaction,
      DebtTransactionItem,
      DebtPayment,
      DebtPaymentAllocation,
      DebtPaymentAdjustment,
      DebtSnapshot,
    ]),
    AuthModule,
  ],
  controllers: [DebtController],
  providers: [
    DebtCustomersService,
    DebtProductsService,
    DebtTransactionsService,
    DebtPaymentsService,
    DebtSnapshotsService,
    DebtReportsService,
  ],
})
export class DebtModule {}
