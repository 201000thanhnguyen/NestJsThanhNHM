import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard';
import { DebtCustomersService } from './debt-customers.service';
import { DebtPaymentsService } from './debt-payments.service';
import { DebtProductsService } from './debt-products.service';
import { DebtReportsService } from './debt-reports.service';
import { DebtTransactionsService } from './debt-transactions.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateDebtTransactionDto } from './dto/create-debt-transaction.dto';
import { CreatePaymentAdjustmentDto } from './dto/create-payment-adjustment.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller(['debt', 'api/debt'])
@UseGuards(JwtCookieGuard)
export class DebtController {
  constructor(
    private readonly customers: DebtCustomersService,
    private readonly products: DebtProductsService,
    private readonly transactions: DebtTransactionsService,
    private readonly payments: DebtPaymentsService,
    private readonly reports: DebtReportsService,
  ) {}

  // --- Customers ---
  @Get('customers')
  listCustomers(@Query('search') search?: string, @Query('q') q?: string) {
    return this.customers.findAll(search ?? q);
  }

  @Post('customers')
  createCustomer(@Body() dto: CreateCustomerDto) {
    return this.customers.create(dto);
  }

  @Patch('customers/:id')
  updateCustomer(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customers.update(id, dto);
  }

  @Get('customers/:id/timeline')
  customerTimeline(@Param('id') id: string) {
    return this.reports.timeline(id);
  }

  @Get('customers/:id')
  getCustomer(@Param('id') id: string) {
    return this.customers.findOne(id);
  }

  // --- Products ---
  @Get('products')
  listProducts(@Query('search') search?: string) {
    return this.products.findAll(search);
  }

  @Get('products/autocomplete')
  autocompleteProducts(@Query('search') search?: string, @Query('limit') limit?: string) {
    const n = limit ? Number(limit) : undefined;
    return this.products.searchForAutocomplete(search, n);
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto) {
    return this.products.create(dto);
  }

  @Patch('products/:id')
  updateProduct(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.products.update(id, dto);
  }

  @Delete('products/:id')
  deactivateProduct(@Param('id') id: string) {
    return this.products.softRemove(id);
  }

  // --- Transactions ---
  @Post('transactions')
  createTransaction(@Body() dto: CreateDebtTransactionDto) {
    return this.transactions.create(dto);
  }

  @Get('transactions')
  listTransactions(@Query('customerId') customerId?: string) {
    return this.transactions.findAll(customerId);
  }

  @Get('transactions/:id')
  getTransaction(@Param('id') id: string) {
    return this.transactions.findOne(id);
  }

  // --- Payments ---
  @Post('payments')
  createPayment(@Body() dto: CreatePaymentDto) {
    return this.payments.create(dto);
  }

  @Get('payments')
  listPayments(@Query('customerId') customerId?: string) {
    return this.payments.findAll(customerId);
  }

  @Post('payments/:paymentId/adjustments')
  addPaymentAdjustment(
    @Param('paymentId') paymentId: string,
    @Body() dto: CreatePaymentAdjustmentDto,
  ) {
    return this.payments.addAdjustment(paymentId, dto);
  }

  @Get('payments/:id')
  async getPayment(@Param('id') id: string) {
    const data = await this.payments.findOneWithAllocations(id);
    if (!data) throw new NotFoundException('Không tìm thấy thanh toán');
    return { data };
  }

  // --- Reports ---
  @Get('report')
  report(@Query('fromDate') fromDate?: string, @Query('toDate') toDate?: string) {
    return this.reports.report(fromDate, toDate);
  }

  @Get('reports/customer-debts')
  customerDebts() {
    return this.reports.customerDebts();
  }
}
