import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImageEntity } from './image.entity';

@Injectable()
export class ImageRepository {
  constructor(
    @InjectRepository(ImageEntity)
    private readonly repo: Repository<ImageEntity>,
  ) {}

  create(data: Partial<ImageEntity>): ImageEntity {
    return this.repo.create(data);
  }

  save(image: ImageEntity): Promise<ImageEntity> {
    return this.repo.save(image);
  }

  findAll(): Promise<ImageEntity[]> {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }

  findById(id: string): Promise<ImageEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
  }
}
