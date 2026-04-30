import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CreateAttendanceDto } from './dto/create-attendance.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { Attendance, AttendanceStatus } from './attendance.entity';
import { Shift } from '../shifts/shift.entity';
import { Transaction } from '../transactions/transaction.entity';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepository: Repository<Attendance>,
    @InjectRepository(Shift)
    private shiftsRepository: Repository<Shift>,
    @InjectRepository(Transaction)
    private transactionsRepository: Repository<Transaction>,
  ) {}

  async findAll() {
    const items = await this.attendanceRepository.find({ order: { date: 'ASC' } });
    return { data: items.map((item) => this.toResponse(item)) };
  }

  async create(body: CreateAttendanceDto) {
    this.validateDate(body.date);
    await this.ensureShiftIdsExist(body.shiftIds);

    const existing = await this.attendanceRepository.findOneBy({ date: body.date });
    if (existing) {
      throw new BadRequestException(`Attendance with date ${body.date} already exists`);
    }

    const attendance = this.attendanceRepository.create({
      date: body.date,
      shiftIds: body.shiftIds,
      note: body.note,
      status: this.computeStatus(body.shiftIds),
    });

    const created = await this.attendanceRepository.save(attendance);
    await this.syncAttendanceTransaction(created.date, created.shiftIds);
    return { data: this.toResponse(created) };
  }

  async updateById(id: string, body: UpdateAttendanceDto) {
    const numericId = this.parseAttendanceId(id);
    await this.ensureShiftIdsExist(body.shiftIds);
    const attendance = await this.attendanceRepository.findOneBy({ id: numericId });
    if (!attendance) {
      throw new NotFoundException(`Attendance with id ${id} not found`);
    }

    attendance.shiftIds = body.shiftIds;
    attendance.note = body.note;
    attendance.status = this.computeStatus(body.shiftIds);

    const updated = await this.attendanceRepository.save(attendance);
    await this.syncAttendanceTransaction(updated.date, updated.shiftIds);
    return { data: this.toResponse(updated) };
  }

  private computeStatus(shiftIds: string[]): AttendanceStatus {
    if (shiftIds.length > 0) {
      return 'working';
    }
    return 'absent';
  }

  private validateDate(date: string) {
    const pattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!pattern.test(date)) {
      throw new BadRequestException('date must match format YYYY-MM-DD');
    }

    const parsed = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
      throw new BadRequestException('date is invalid');
    }
  }

  private parseAttendanceId(id: string): number {
    const normalized = id.startsWith('att_') ? id.slice(4) : id;
    const numericId = Number(normalized);

    if (!Number.isInteger(numericId) || numericId <= 0) {
      throw new BadRequestException('id is invalid');
    }

    return numericId;
  }

  private toResponse(attendance: Attendance) {
    return {
      id: `att_${attendance.id}`,
      date: attendance.date,
      shiftIds: attendance.shiftIds,
      note: attendance.note ?? null,
      status: attendance.status,
    };
  }

  private async syncAttendanceTransaction(date: string, shiftIds: string[]) {
    const period = date.slice(0, 7);
    const existingTx = await this.transactionsRepository.findOneBy({ date, type: 'attendance' });

    if (shiftIds.length === 0) {
      if (existingTx) {
        await this.transactionsRepository.delete(existingTx.id);
      }
      return;
    }

    const shifts = await this.shiftsRepository.findBy({ id: In(shiftIds) });

    const amount = shifts.reduce((sum, shift) => sum + shift.salary, 0);

    if (existingTx) {
      existingTx.amount = amount;
      existingTx.period = period;
      await this.transactionsRepository.save(existingTx);
      return;
    }

    await this.transactionsRepository.save(
      this.transactionsRepository.create({
        date,
        amount,
        type: 'attendance',
        period,
      }),
    );
  }

  private async ensureShiftIdsExist(shiftIds: string[]) {
    if (shiftIds.length === 0) {
      return;
    }

    const shifts = await this.shiftsRepository.findBy({ id: In(shiftIds) });
    if (shifts.length !== shiftIds.length) {
      throw new BadRequestException('One or more shiftIds do not exist');
    }
  }
}
