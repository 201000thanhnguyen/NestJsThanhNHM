import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('shifts')
export class Shift {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  startTime: string;

  @Column()
  endTime: string;

  @Column('int')
  salary: number;
}
