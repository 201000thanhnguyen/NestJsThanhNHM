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
    const qb = this.products
      .createQueryBuilder('p')
      .orderBy('p.createdAt', 'DESC');
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
    const raw = search?.trim() ?? '';
    const q = raw.toLowerCase();
    const take = Math.min(Math.max(limit, 1), 10);

    const fetchTopUsed = async () => {
      const topRows = await this.products.manager.query(
        `
        SELECT product_id, COUNT(*) AS usage_count
        FROM giao_dich_san_pham
        WHERE product_id IS NOT NULL
        GROUP BY product_id
        ORDER BY usage_count DESC
        LIMIT 12
        `,
      );

      const topIds = topRows.map((r) => r.product_id).filter(Boolean);
      if (!topIds.length) return [] as DebtProduct[];

      const topProducts = await this.products
        .createQueryBuilder('p')
        .where('p.id IN (:...ids)', { ids: topIds })
        .andWhere('p.is_active = true')
        .getMany();
      const order = new Map(topIds.map((id, i) => [id, i]));
      topProducts.sort(
        (a, b) =>
          Number(order.get(a.id) ?? 0) - Number(order.get(b.id) ?? 0),
      );
      return topProducts;
    };

    // No keyword: return top-used (fast entry), cap to `take`.
    if (!q) {
      const topProducts = (await fetchTopUsed()).slice(0, take);
      return {
        data: {
          results: [],
          topUsed: topProducts,
          merged: topProducts,
        },
      };
    }

    // Avoid overly-loose matching for 1-character searches.
    if (q.length < 2) {
      return { data: { results: [], topUsed: [], merged: [] } };
    }

    const out: DebtProduct[] = [];
    const seen = new Set<string>();
    const pushUnique = (rows: DebtProduct[]) => {
      for (const p of rows) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        out.push(p);
        if (out.length >= take) break;
      }
    };

    // LEVEL 1: starts with keyword.
    const level1 = await this.products
      .createQueryBuilder('p')
      .where('p.isActive = :active', { active: true })
      .andWhere('LOWER(p.name) LIKE :s', { s: `${q}%` })
      .orderBy('p.name', 'ASC')
      .take(take)
      .getMany();
    pushUnique(level1);

    // LEVEL 2: word match (space + keyword) if needed.
    if (out.length < take) {
      const remaining = take - out.length;
      const level2 = await this.products
        .createQueryBuilder('p')
        .where('p.isActive = :active', { active: true })
        .andWhere('LOWER(p.name) LIKE :s', { s: `% ${q}%` })
        .orderBy('p.name', 'ASC')
        .take(remaining)
        .getMany();
      pushUnique(level2);
    }

    // LEVEL 3: contains (only if no result from above).
    if (out.length === 0) {
      const level3 = await this.products
        .createQueryBuilder('p')
        .where('p.isActive = :active', { active: true })
        .andWhere('LOWER(p.name) LIKE :s', { s: `%${q}%` })
        .orderBy('p.name', 'ASC')
        .take(take)
        .getMany();
      pushUnique(level3);
    }

    // IMPORTANT: when keyword is provided, do NOT merge in top-used unrelated items.
    return {
      data: {
        results: out,
        topUsed: [],
        merged: out,
      },
    };
  }

  async update(id: string, dto: UpdateProductDto) {
    const row = await this.products.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy sản phẩm');

    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.defaultPrice !== undefined)
      row.defaultPrice = moneyStr(dto.defaultPrice);
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
