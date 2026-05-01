import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtCookieGuard } from '../auth/jwt-cookie.guard';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { QuotesService } from './quotes.service';

@Controller(['quotes', 'api/quotes'])
export class QuotesController {
  constructor(private readonly quotesService: QuotesService) {}

  @Get()
  findAll() {
    return this.quotesService.findAll();
  }

  @Post()
  @UseGuards(JwtCookieGuard)
  create(@Body() dto: CreateQuoteDto) {
    return this.quotesService.create(dto);
  }

  @Put(':id')
  @UseGuards(JwtCookieGuard)
  update(@Param('id') id: string, @Body() dto: UpdateQuoteDto) {
    return this.quotesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtCookieGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.quotesService.remove(id);
  }
}

