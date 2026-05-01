import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateShiftDto } from './dto/create-shift.dto';
import { UpdateShiftDto } from './dto/update-shift.dto';
import { Shift } from './shift.entity';

@Injectable()
export class ShiftsService {
  constructor(
    @InjectRepository(Shift)
    private shiftsRepository: Repository<Shift>,
  ) {}

  async create(createShiftDto: CreateShiftDto) {
    const shift = this.shiftsRepository.create(createShiftDto);
    const savedShift = await this.shiftsRepository.save(shift);

    return { data: savedShift };
  }

  async findAll() {
    const shifts = await this.shiftsRepository.find();

    return { data: shifts };
  }

  async update(id: string, updateShiftDto: UpdateShiftDto) {
    const shift = await this.shiftsRepository.findOne({ where: { id } });
    if (!shift) {
      throw new NotFoundException(`Shift with id ${id} not found`);
    }

    const merged = this.shiftsRepository.merge(shift, updateShiftDto);
    const saved = await this.shiftsRepository.save(merged);

    return { data: saved };
  }

  async delete(id: string) {
    const result = await this.shiftsRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Shift with id ${id} not found`);
    }
  }
}

