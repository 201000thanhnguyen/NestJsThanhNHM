import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImageService } from './image.service';
import { UpdateImageDto } from './dto/update-image.dto';

@Controller('images')
export class ImageController {
  constructor(private readonly images: ImageService) {}

  @Get()
  list() {
    return this.images.list();
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async create(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('File is required');
    return this.images.createFromUpload(file);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
  )
  async update(
    @Param('id') id: string,
    @Body() body: UpdateImageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    return this.images.update(id, { name: body?.name, file });
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.images.remove(id);
    return { ok: true };
  }
}
