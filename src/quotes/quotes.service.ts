import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { Quote } from './quote.entity';

@Injectable()
export class QuotesService {
  constructor(
    @InjectRepository(Quote)
    private readonly quotesRepository: Repository<Quote>,
  ) {}

  async findAll() {
    const quotes = await this.quotesRepository.find({
      order: { createdAt: 'DESC' },
    });
    return { data: quotes };
  }

  async create(dto: CreateQuoteDto) {
    const quote = this.quotesRepository.create({
      content: dto.content.trim(),
      author: dto.author.trim(),
    });
    const saved = await this.quotesRepository.save(quote);
    return { data: saved };
  }

  async update(id: string, dto: UpdateQuoteDto) {
    const quote = await this.quotesRepository.findOne({ where: { id } });
    if (!quote) throw new NotFoundException(`Quote with id ${id} not found`);

    const merged = this.quotesRepository.merge(quote, {
      ...(dto.content !== undefined ? { content: dto.content.trim() } : null),
      ...(dto.author !== undefined ? { author: dto.author.trim() } : null),
    });
    const saved = await this.quotesRepository.save(merged);
    return { data: saved };
  }

  async remove(id: string) {
    const result = await this.quotesRepository.delete(id);
    if (result.affected === 0) throw new NotFoundException(`Quote with id ${id} not found`);
  }
}

