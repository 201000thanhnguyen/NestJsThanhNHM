import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type AttendanceStatus = 'working' | 'absent' | 'not_checked';

@Entity('attendance')
export class Attendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'varchar', length: 10, unique: true })
  date: string;

  @Column('simple-json')
  shiftIds: string[];

  @Column({ type: 'varchar', length: 255, nullable: true })
  note?: string | null;

  @Column({ type: 'varchar', length: 20 })
  status: AttendanceStatus;
}
