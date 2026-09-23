import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Student } from './student.entity';

export enum AttendanceSession {
  MORNING = 'morning',
  AFTERNOON = 'afternoon',
}

export enum AttendanceStatus {
  PRESENT = 'present',
  LATE = 'late',
  ABSENT = 'absent',
  EXCUSED = 'excused',
}

@Entity('attendances')
@Index(['studentId', 'date', 'session'], { unique: true })
@Index(['deviceId', 'date', 'session'], { unique: true })
export class Attendance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'student_id' })
  studentId: number;

  @ManyToOne(() => Student, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student: Student;

  @Column({ name: 'device_id' })
  deviceId: string;

  @Column()
  date: string; // YYYY-MM-DD

  @Column({ type: 'text' })
  session: AttendanceSession;

  @Column({ type: 'text', default: AttendanceStatus.PRESENT })
  status: AttendanceStatus;

  @Column({ name: 'check_in_time', nullable: true })
  checkInTime: string; // HH:mm:ss

  @Column({ type: 'real', nullable: true })
  latitude: number;

  @Column({ type: 'real', nullable: true })
  longitude: number;

  @Column({ nullable: true })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
