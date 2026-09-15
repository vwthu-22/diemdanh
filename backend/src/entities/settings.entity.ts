import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('settings')
export class Settings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'school_lat', type: 'float', nullable: true, default: 20.868382 })
  schoolLat: number;

  @Column({ name: 'school_lng', type: 'float', nullable: true, default: 105.857279 })
  schoolLng: number;

  @Column({ name: 'radius_meters', type: 'int', nullable: true, default: 100 })
  radiusMeters: number;

  // Morning session
  @Column({ name: 'morning_start', nullable: true, default: '07:30' })
  morningStart: string;

  @Column({ name: 'morning_on_time_end', nullable: true, default: '07:45' })
  morningOnTimeEnd: string;

  @Column({ name: 'morning_late_end', nullable: true, default: '08:15' })
  morningLateEnd: string;

  // Afternoon session
  @Column({ name: 'afternoon_start', nullable: true, default: '13:00' })
  afternoonStart: string;

  @Column({ name: 'afternoon_on_time_end', nullable: true, default: '13:15' })
  afternoonOnTimeEnd: string;

  @Column({ name: 'afternoon_late_end', nullable: true, default: '13:45' })
  afternoonLateEnd: string;

  // Weekly Schedule: day of week (0=CN, 1=T2,... 6=T7) -> ['morning', 'afternoon']
  @Column({ name: 'schedule', type: 'simple-json', nullable: true })
  schedule: Record<string, string[]>;

  // Ngày bắt đầu tính điểm danh (mặc định 2026-09-15)
  @Column({ name: 'start_date', nullable: true, default: '2026-09-15' })
  startDate: string;
}

export const DEFAULT_SCHEDULE: Record<string, string[]> = {
  '1': ['morning'],
  '2': ['morning', 'afternoon'],
  '3': ['morning', 'afternoon'],
  '4': ['morning'],
  '5': ['morning', 'afternoon'],
  '6': [],
  '0': [],
};
