import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { DebtProduct } from './entities/product.entity';
import { moneyStr } from './debt.utils';

type TopRow = { product_id: string; usage_count: string };

@Injectable()
export class DebtProductsService {
  constructor(
    @InjectRepository(DebtProduct)
    private readonly products: Repository<DebtProduct>,
  ) {}

  async create(dto: CreateProductDto) {
    const row = this.products.create({
      name: dto.name.trim(),
      defaultPrice: moneyStr(dto.defaultPrice),
      isActive: dto.isActive ?? true,
    });
    const saved = await this.products.save(row);
    return { data: saved };
  }

  async findAll(search?: string) {
    const q = search?.trim();
    const qb = this.products.createQueryBuilder('p').orderBy('p.createdAt', 'DESC');
    if (q) {
      qb.where('p.name LIKE :s', { s: `%${q}%` });
    }
    const data = await qb.getMany();
    return { data };
  }

  /**
   * Autocomplete: active products matching search, plus top-used product ids (by line-item frequency).
   */
  async searchForAutocomplete(search?: string, limit = 20) {
    const q = search?.trim() ?? '';
    const take = Math.min(Math.max(limit, 1), 50);

    const qb = this.products
      .createQueryBuilder('p')
      .where('p.isActive = :active', { active: true })
      .orderBy('p.name', 'ASC')
      .take(take);

    if (q) {
      qb.andWhere('p.name LIKE :s', { s: `%${q}%` });
    }

    const matched = await qb.getMany();

    const topRows = await this.products.manager.query(
      `
      SELECT product_id, COUNT(*) AS usage_count
      FROM giao_dich_san_pham
      WHERE product_id IS NOT NULL
      GROUP BY product_id
      ORDER BY usage_count DESC
      LIMIT 12
      `,
    ) as TopRow[];

    const topIds = topRows.map((r) => r.product_id).filter(Boolean);
    let topProducts: DebtProduct[] = [];
    if (topIds.length) {
      topProducts = await this.products
        .createQueryBuilder('p')
        .where('p.id IN (:...ids)', { ids: topIds })
        .andWhere('p.is_active = true')
        .getMany();
      const order = new Map(topIds.map((id, i) => [id, i]));
      topProducts.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
    }

    const byId = new Map<string, DebtProduct>();
    for (const p of topProducts) byId.set(p.id, p);
    for (const p of matched) byId.set(p.id, p);

    return {
      data: {
        results: matched,
        topUsed: topProducts,
        merged: [...byId.values()],
      },
    };
  }

  async update(id: string, dto: UpdateProductDto) {
    const row = await this.products.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy sản phẩm');

    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.defaultPrice !== undefined) row.defaultPrice = moneyStr(dto.defaultPrice);
    if (dto.isActive !== undefined) row.isActive = dto.isActive;

    const saved = await this.products.save(row);
    return { data: saved };
  }

  async softRemove(id: string) {
    const row = await this.products.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy sản phẩm');
    row.isActive = false;
    const saved = await this.products.save(row);
    return { data: saved };
  }

  async findActiveById(id: string): Promise<DebtProduct | null> {
    return this.products.findOne({ where: { id, isActive: true } });
  }
}
