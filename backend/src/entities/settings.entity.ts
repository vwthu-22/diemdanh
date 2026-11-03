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
 * Thời khóa biểu gốc của lớp CQP22 từ Tuần 5 đến Tuần 20
 * Được trích xuất trực tiếp từ dữ liệu bài học thực tế (SCHEDULE_DATA).
 * Hệ thống sẽ tự động dùng lịch này làm mặc định cho từng tuần,
 * chỉ dùng tùy chỉnh riêng khi Quản trị viên sửa đổi (weeklySchedules).
 */
export const TIMETABLE_WEEKLY_SCHEDULES: Record<string, Record<string, string[]>> = {
  // Tuần 5 (14/09 – 20/09/2026)
  '2026-09-14': { '0': [], '1': ['morning'], '2': ['morning', 'afternoon'], '3': ['morning', 'afternoon'], '4': ['morning'], '5': ['morning', 'afternoon'], '6': [] },
  // Tuần 6 (21/09 – 27/09/2026)
  '2026-09-21': { '0': [], '1': ['morning'], '2': ['morning', 'afternoon'], '3': ['morning', 'afternoon'], '4': ['morning'], '5': ['morning', 'afternoon'], '6': [] },
  // Tuần 7 (28/09 – 04/10/2026)
  '2026-09-28': { '0': [], '1': ['morning'], '2': ['morning', 'afternoon'], '3': ['afternoon'], '4': ['morning'], '5': ['morning', 'afternoon'], '6': [] },
  // Tuần 8 (05/10 – 11/10/2026)
  '2026-10-05': { '0': [], '1': ['morning'], '2': ['morning', 'afternoon'], '3': ['morning', 'afternoon'], '4': ['morning'], '5': ['morning', 'afternoon'], '6': [] },
  // Tuần 9 (12/10 – 18/10/2026)
  '2026-10-12': { '0': [], '1': ['morning'], '2': ['morning', 'afternoon'], '3': ['morning', 'afternoon'], '4': ['morning'], '5': ['morning', 'afternoon'], '6': [] },
  // Tuần 10 (19/10 – 25/10/2026)
  '2026-10-19': { '0': [], '1': [], '2': ['morning', 'afternoon'], '3': ['afternoon'], '4': ['morning'], '5': ['afternoon'], '6': [] },
  // Tuần 11 (26/10 – 01/11/2026)
  '2026-10-26': { '0': [], '1': ['morning'], '2': ['afternoon'], '3': [], '4': [], '5': ['morning'], '6': [] },
  // Tuần 12 (02/11 – 08/11/2026)
  '2026-11-02': { '0': [], '1': [], '2': ['afternoon'], '3': ['morning'], '4': [], '5': ['morning'], '6': [] },
  // Tuần 13 (09/11 – 15/11/2026)
  '2026-11-09': { '0': [], '1': [], '2': ['afternoon'], '3': ['morning'], '4': [], '5': ['morning'], '6': [] },
  // Tuần 14 (16/11 – 22/11/2026)
  '2026-11-16': { '0': [], '1': ['morning'], '2': ['afternoon'], '3': ['morning'], '4': [], '5': ['morning', 'afternoon'], '6': [] },
  // Tuần 15 (23/11 – 29/11/2026)
  '2026-11-23': { '0': [], '1': ['morning'], '2': [], '3': [], '4': ['morning'], '5': ['morning', 'afternoon'], '6': ['afternoon'] },
  // Tuần 16 (30/11 – 06/12/2026)
  '2026-11-30': { '0': [], '1': [], '2': ['morning', 'afternoon'], '3': [], '4': ['morning'], '5': ['morning', 'afternoon'], '6': [] },
  // Tuần 17 (07/12 – 13/12/2026)
  '2026-12-07': { '0': [], '1': [], '2': ['morning', 'afternoon'], '3': [], '4': ['morning'], '5': ['morning'], '6': [] },
  // Tuần 18 (14/12 – 20/12/2026)
  '2026-12-14': { '0': [], '1': [], '2': ['morning', 'afternoon'], '3': [], '4': ['morning'], '5': [], '6': [] },
  // Tuần 19 (21/12 – 27/12/2026)
  '2026-12-21': { '0': [], '1': [], '2': ['morning', 'afternoon'], '3': [], '4': ['morning'], '5': [], '6': [] },
  // Tuần 20 (28/12 – 03/01/2027)
  '2026-12-28': { '0': [], '1': [], '2': ['morning'], '3': [], '4': ['morning'], '5': [], '6': [] },
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
 * Lấy thời khóa biểu cho một ngày cụ thể:
 * 1. Ưu tiên cao nhất: Lịch riêng tuần này do Admin cấu hình (weeklySchedules[monday])
 * 2. Mặc định tự động: Lịch theo đúng Thời khóa biểu CQP22 (TIMETABLE_WEEKLY_SCHEDULES[monday])
 * 3. Fallback: Lịch chung cài đặt trong hệ thống (settings.schedule hoặc DEFAULT_SCHEDULE)
 */
export function getScheduleForDate(
  settings: Settings,
  dateStr: string,
): Record<string, string[]> {
  const monday = getMondayOfWeek(dateStr);
  if (
    settings?.weeklySchedules &&
    settings.weeklySchedules[monday] &&
    typeof settings.weeklySchedules[monday] === 'object'
  ) {
    return settings.weeklySchedules[monday];
  }
  if (TIMETABLE_WEEKLY_SCHEDULES[monday]) {
    return TIMETABLE_WEEKLY_SCHEDULES[monday];
  }
  return settings?.schedule || DEFAULT_SCHEDULE;
}

