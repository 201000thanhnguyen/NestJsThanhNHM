import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import sharp from 'sharp';
import path from 'path';
import { promises as fs } from 'fs';
import { randomUUID } from 'crypto';
import { ImageRepository } from './image.repository';
import { ImageEntity } from './image.entity';
import {
  ensureDirExists,
  getUploadPath,
  deleteFileSafe,
  urlToDiskPath,
} from './image.utils';

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

@Injectable()
export class ImageService {
  constructor(private readonly images: ImageRepository) {}

  async list(): Promise<ImageEntity[]> {
    return this.images.findAll();
  }

  async createFromUpload(file: Express.Multer.File): Promise<ImageEntity> {
    if (!file) throw new BadRequestException('File is required');
    if (typeof file.size === 'number' && file.size > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException('File too large (max 5MB)');
    }

    const uploadDir = getUploadPath();
    await ensureDirExists(uploadDir);

    const { fileName } = await this.saveValidatedImage(file.buffer);

    const url = path.posix.join('/images', fileName);
    const image = this.images.create({ url, name: 'Untitled' });
    return this.images.save(image);
  }

  async update(
    id: string,
    opts: { name?: string; file?: Express.Multer.File },
  ): Promise<ImageEntity> {
    const image = await this.images.findById(id);
    if (!image) throw new NotFoundException('Image not found');

    if (typeof opts.name === 'string') {
      image.name = opts.name;
    }

    if (opts.file) {
      if (
        typeof opts.file.size === 'number' &&
        opts.file.size > MAX_FILE_SIZE_BYTES
      ) {
        throw new BadRequestException('File too large (max 5MB)');
      }

      const uploadDir = getUploadPath();
      await ensureDirExists(uploadDir);

      // Save new file first, only then delete old file (safety).
      const { fileName: newFileName } = await this.saveValidatedImage(
        opts.file.buffer,
      );

      const oldDiskPath = urlToDiskPath(image.url);
      await deleteFileSafe(oldDiskPath);

      image.url = path.posix.join('/images', newFileName);
    }

    return this.images.save(image);
  }

  async remove(id: string): Promise<void> {
    const image = await this.images.findById(id);
    if (!image) throw new NotFoundException('Image not found');

    const diskPath = urlToDiskPath(image.url);
    await deleteFileSafe(diskPath);
    await this.images.deleteById(id);
  }

  private async saveValidatedImage(
    buffer: Buffer,
  ): Promise<{ fileName: string; ext: 'jpg' | 'png' | 'webp' }> {
    if (!buffer || buffer.length === 0)
      throw new BadRequestException('Empty file');

    let metadata: sharp.Metadata;
    try {
      // This will throw if input is not a real image.
      metadata = await sharp(buffer).metadata();
    } catch {
      throw new BadRequestException('Invalid image file');
    }

    const fmt = metadata.format;
    const ext = this.formatToExt(fmt);
    if (!ext) throw new BadRequestException('Unsupported image type');

    const fileName = `${randomUUID()}.${ext}`;
    const diskPath = getUploadPath(fileName);

    // Save EXACT bytes as uploaded (no resize/compress/re-encode).
    await fs.writeFile(diskPath, buffer);

    return { fileName, ext };
  }

  private formatToExt(
    fmt: sharp.Metadata['format'],
  ): 'jpg' | 'png' | 'webp' | null {
    if (fmt === 'jpeg') return 'jpg';
    if (fmt === 'png') return 'png';
    if (fmt === 'webp') return 'webp';
    return null;
  }
}
