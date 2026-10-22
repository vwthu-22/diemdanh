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

  // Evening session
  @Column({ name: 'evening_start', nullable: true, default: '18:00' })
  eveningStart: string;

  @Column({ name: 'evening_on_time_end', nullable: true, default: '18:15' })
  eveningOnTimeEnd: string;

  @Column({ name: 'evening_late_end', nullable: true, default: '18:45' })
  eveningLateEnd: string;

  // Weekly Schedule template: day of week (0=CN, 1=T2,... 6=T7) -> ['morning', 'afternoon', 'evening']
  @Column({ name: 'schedule', type: 'simple-json', nullable: true })
  schedule: Record<string, string[]>;

  // Custom schedule per specific week: { '2026-09-14': { '1': ['morning'], '2': ... } }
  // Key is the Monday date (YYYY-MM-DD) of that week
  @Column({ name: 'weekly_schedules', type: 'simple-json', nullable: true })
  weeklySchedules: Record<string, Record<string, string[]>>;

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

/**
 * Lấy ngày Thứ 2 đầu tuần (YYYY-MM-DD) của bất kỳ ngày nào
 */
export function getMondayOfWeek(dateStr: string): string {
  const parts = dateStr.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const d = parseInt(parts[2], 10);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay(); // 0 = Chủ Nhật, 1 = Thứ 2, ...
  const diff = (day === 0 ? -6 : 1) - day;
  date.setUTCDate(date.getUTCDate() + diff);
  return date.toISOString().slice(0, 10);
}

/**
 * Lấy thời khóa biểu cho một ngày cụ thể (ưu tiên lịch riêng của tuần, nếu không có dùng lịch mặc định)
 */
export function getScheduleForDate(
  settings: Settings,
  dateStr: string,
): Record<string, string[]> {
  const monday = getMondayOfWeek(dateStr);
  if (
    settings.weeklySchedules &&
    settings.weeklySchedules[monday] &&
    typeof settings.weeklySchedules[monday] === 'object'
  ) {
    return settings.weeklySchedules[monday];
  }
  return settings.schedule || DEFAULT_SCHEDULE;
}

