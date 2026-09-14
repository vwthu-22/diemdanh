import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'order_num' })
  orderNum: number;

  @Column()
  name: string;

  @Column({ nullable: true })
  dob: string;

  @Column({ name: 'device_id', nullable: true })
  deviceId?: string;
}
