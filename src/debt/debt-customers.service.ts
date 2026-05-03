import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { DebtCustomer } from './entities/customer.entity';

@Injectable()
export class DebtCustomersService {
  constructor(
    @InjectRepository(DebtCustomer)
    private readonly customers: Repository<DebtCustomer>,
  ) {}

  async create(dto: CreateCustomerDto) {
    const row = this.customers.create({
      name: dto.name.trim(),
      phone: dto.phone?.trim() || null,
      note: dto.note?.trim() || null,
    });
    const saved = await this.customers.save(row);
    return { data: saved };
  }

  /**
   * @param search — optional LIKE search on name/phone (case-insensitive), max 10 rows.
   * @param listAll — when true and no search, return recent customers (capped).
   */
  async findAll(search?: string, listAll = true) {
    const q = search?.trim();
    const qb = this.customers.createQueryBuilder('c');

    if (q) {
      const like = `%${q}%`;
      qb.where(
        '(LOWER(c.name) LIKE LOWER(:like) OR (c.phone IS NOT NULL AND LOWER(c.phone) LIKE LOWER(:like)))',
        { like },
      )
        .orderBy('c.name', 'ASC')
        .take(10);
    } else if (listAll) {
      qb.orderBy('c.createdAt', 'DESC').take(300);
    } else {
      qb.orderBy('c.createdAt', 'DESC').take(50);
    }

    const data = await qb.getMany();
    return { data };
  }

  async findOne(id: string) {
    const row = await this.customers.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy khách hàng');
    return { data: row };
  }

  async assertExists(id: string): Promise<DebtCustomer> {
    const row = await this.customers.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy khách hàng');
    return row;
  }

  async update(id: string, dto: UpdateCustomerDto) {
    const row = await this.customers.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy khách hàng');

    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.phone !== undefined) row.phone = dto.phone?.trim() || null;
    if (dto.note !== undefined) row.note = dto.note?.trim() || null;

    const saved = await this.customers.save(row);
    return { data: saved };
  }
}
