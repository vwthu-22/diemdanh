export type AttendanceSession = 'morning' | 'afternoon';

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

export interface Student {
  id: number;
  orderNum: number;
  name: string;
  dob: string;
  deviceId?: string | null;
}

export interface AttendanceRecord {
  id: number;
  studentId: number;
  deviceId: string;
  date: string;
  session: AttendanceSession;
  status: AttendanceStatus;
  checkInTime: string | null;
  latitude: number | null;
  longitude: number | null;
  note: string | null;
  student?: Student;
}

export interface SessionInfo {
  session: AttendanceSession;
  label: string;
  isScheduled?: boolean;
  isOpen: boolean;
  isOnTime: boolean;
  isLate: boolean;
  start: string;
  onTimeEnd: string;
  lateEnd: string;
}

export interface SessionStatusResponse {
  today: string;
  currentTime: string;
  sessions: SessionInfo[];
}

export interface DailyAttendanceRow {
  student: Student;
  morning: AttendanceRecord | null;
  afternoon: AttendanceRecord | null;
}

export interface Settings {
  id: number;
  schoolLat: number;
  schoolLng: number;
  radiusMeters: number;
  morningStart: string;
  morningOnTimeEnd: string;
  morningLateEnd: string;
  afternoonStart: string;
  afternoonOnTimeEnd: string;
  afternoonLateEnd: string;
  schedule?: Record<string, string[]>;
  startDate?: string;
}
