import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Attendance,
  AttendanceSession,
  AttendanceStatus,
} from '../../entities/attendance.entity';
import { Student } from '../../entities/student.entity';
import { Settings, DEFAULT_SCHEDULE } from '../../entities/settings.entity';
import { SettingsService } from '../settings/settings.service';
import { CheckInDto } from './dto/checkin.dto';
import {
  haversineDistance,
  getTodayVN,
  getCurrentTimeVN,
  compareTime,
  getVietnamNow,
} from '../../utils/geo.util';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    private settingsService: SettingsService,
  ) {}

  private async getSettings(): Promise<Settings> {
    return this.settingsService.getSettings();
  }

  /**
   * Xác định buổi đang mở và trạng thái của khung giờ hiện tại
   */
  async getSessionStatus() {
    const settings = await this.getSettings();
    const currentTime = getCurrentTimeVN();
    const today = getTodayVN();

    const sessions = [
      {
        session: AttendanceSession.MORNING,
        label: 'Buổi sáng',
        start: settings.morningStart,
        onTimeEnd: settings.morningOnTimeEnd,
        lateEnd: settings.morningLateEnd,
      },
      {
        session: AttendanceSession.AFTERNOON,
        label: 'Buổi chiều',
        start: settings.afternoonStart,
        onTimeEnd: settings.afternoonOnTimeEnd,
        lateEnd: settings.afternoonLateEnd,
      },
    ];

    const now = getVietnamNow();
    const dow = String(now.getDay());
    const schedule = settings.schedule || DEFAULT_SCHEDULE;

    const result = sessions.map((s) => {
      const isScheduled = schedule[dow]?.includes(s.session) ?? true;
      const isOpen =
        isScheduled &&
        compareTime(currentTime, s.start) >= 0 &&
        compareTime(currentTime, s.lateEnd) <= 0;
      const isOnTime =
        isScheduled &&
        compareTime(currentTime, s.start) >= 0 &&
        compareTime(currentTime, s.onTimeEnd) <= 0;
      const isLate =
        isScheduled &&
        compareTime(currentTime, s.onTimeEnd) > 0 &&
        compareTime(currentTime, s.lateEnd) <= 0;

      return {
        session: s.session,
        label: s.label,
        isScheduled,
        isOpen,
        isOnTime,
        isLate,
        start: s.start,
        onTimeEnd: s.onTimeEnd,
        lateEnd: s.lateEnd,
      };
    });

    return { today, currentTime, sessions: result };
  }

  /**
   * Kiểm tra sinh viên (và thiết bị) đã điểm danh chưa trong ngày/buổi
   */
  async getMyStatus(deviceId: string, date: string) {
    const records = await this.attendanceRepo.find({
      where: { deviceId, date },
      relations: { student: true },
    });
    return records;
  }

  /**
   * Xử lý điểm danh chính
   */
  async checkIn(dto: CheckInDto) {
    const settings = await this.getSettings();
    const today = getTodayVN();
    const currentTime = getCurrentTimeVN();
    const now = getVietnamNow();
    const checkInTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    // 1. Kiểm tra sinh viên tồn tại
    const student = await this.studentRepo.findOneBy({ id: dto.studentId });
    if (!student) {
      throw new NotFoundException('Không tìm thấy sinh viên');
    }

    // 2. Xác định khung giờ của session được yêu cầu
    let sessionStart: string;
    let sessionOnTimeEnd: string;
    let sessionLateEnd: string;

    if (dto.session === AttendanceSession.MORNING) {
      sessionStart = settings.morningStart;
      sessionOnTimeEnd = settings.morningOnTimeEnd;
      sessionLateEnd = settings.morningLateEnd;
    } else {
      sessionStart = settings.afternoonStart;
      sessionOnTimeEnd = settings.afternoonOnTimeEnd;
      sessionLateEnd = settings.afternoonLateEnd;
    }

    // 2.5 Kiểm tra lịch học buổi này có theo thời khóa biểu không
    const dow = String(now.getDay());
    const schedule = settings.schedule || DEFAULT_SCHEDULE;
    const isScheduled = schedule[dow]?.includes(dto.session) ?? true;
    if (!isScheduled) {
      const sessionLabel =
        dto.session === AttendanceSession.MORNING ? 'sáng' : 'chiều';
      throw new ForbiddenException(
        `Hôm nay lớp không có lịch học buổi ${sessionLabel} theo thời khóa biểu!`,
      );
    }

    // 3. Kiểm tra cổng điểm danh có mở không (server-side time check)
    if (
      compareTime(currentTime, sessionStart) < 0 ||
      compareTime(currentTime, sessionLateEnd) > 0
    ) {
      const sessionLabel =
        dto.session === AttendanceSession.MORNING ? 'sáng' : 'chiều';
      throw new ForbiddenException(
        `Cổng điểm danh buổi ${sessionLabel} đã đóng. Khung giờ: ${sessionStart} - ${sessionLateEnd}`,
      );
    }

    // 4. Kiểm tra khóa thiết bị cố định 1 - 1 (Device Binding)
    // 4.1 Kiểm tra thiết bị này đã liên kết với sinh viên nào chưa
    const studentWithDevice = await this.studentRepo.findOne({
      where: { deviceId: dto.deviceId },
    });
    if (studentWithDevice && studentWithDevice.id !== student.id) {
      throw new ForbiddenException(
        `Thiết bị này đã được liên kết cố định với sinh viên "${studentWithDevice.name}". Bạn không thể dùng thiết bị này để điểm danh cho sinh viên khác!`,
      );
    }

    // 4.2 Kiểm tra sinh viên này đã liên kết với thiết bị nào khác chưa
    if (student.deviceId && student.deviceId !== dto.deviceId) {
      throw new ForbiddenException(
        `Tài khoản "${student.name}" đã được liên kết với một thiết bị khác! Bạn không thể dùng thiết bị này để điểm danh hộ. Vui lòng liên hệ giáo viên nếu bạn đổi máy mới!`,
      );
    }

    // 4.3 Kiểm tra thiết bị đã dùng để điểm danh cho người khác trong cùng buổi này chưa
    const deviceUsed = await this.attendanceRepo.findOne({
      where: { deviceId: dto.deviceId, date: today, session: dto.session },
      relations: { student: true },
    });

    if (deviceUsed && deviceUsed.studentId !== dto.studentId) {
      throw new ForbiddenException(
        `Thiết bị này đã được dùng để điểm danh cho ${deviceUsed.student.name} trong buổi này. Mỗi thiết bị chỉ điểm danh được cho 1 người!`,
      );
    }

    // 4.4 Nếu sinh viên chưa liên kết thiết bị, tự động liên kết thiết bị này vĩnh viễn
    if (!student.deviceId) {
      student.deviceId = dto.deviceId;
      await this.studentRepo.save(student);
    }

    // 5. Kiểm tra sinh viên đã điểm danh buổi này chưa
    const alreadyCheckedIn = await this.attendanceRepo.findOne({
      where: { studentId: dto.studentId, date: today, session: dto.session },
    });

    if (alreadyCheckedIn) {
      throw new BadRequestException(
        `Bạn đã điểm danh buổi ${dto.session === AttendanceSession.MORNING ? 'sáng' : 'chiều'} hôm nay rồi! (lúc ${alreadyCheckedIn.checkInTime})`,
      );
    }

    // 6. Kiểm tra vị trí GPS
    if (settings.schoolLat && settings.schoolLng) {
      const distance = haversineDistance(
        dto.latitude,
        dto.longitude,
        settings.schoolLat,
        settings.schoolLng,
      );

      if (distance > settings.radiusMeters) {
        throw new ForbiddenException(
          `Bạn đang ở ngoài khu vực trường (cách ${Math.round(distance)}m). Vui lòng điểm danh trong phạm vi ${settings.radiusMeters}m!`,
        );
      }
    }

    // 7. Xác định trạng thái (Đúng giờ hay Muộn)
    const status =
      compareTime(currentTime, sessionOnTimeEnd) <= 0
        ? AttendanceStatus.PRESENT
        : AttendanceStatus.LATE;

    // 8. Lưu vào DB
    const attendance = this.attendanceRepo.create({
      studentId: dto.studentId,
      deviceId: dto.deviceId,
      date: today,
      session: dto.session,
      status,
      checkInTime: checkInTimeStr,
      latitude: dto.latitude,
      longitude: dto.longitude,
    });

    await this.attendanceRepo.save(attendance);

    return {
      success: true,
      status,
      checkInTime: checkInTimeStr,
      studentName: student.name,
      message:
        status === AttendanceStatus.PRESENT
          ? `✅ Điểm danh thành công! Bạn đúng giờ.`
          : `⚠️ Điểm danh thành công! Lưu ý bạn đến muộn.`,
    };
  }

  /**
   * Lấy bảng điểm danh theo ngày (dành cho admin)
   */
  async getAttendanceByDate(date: string) {
    const students = await this.studentRepo.find({ order: { orderNum: 'ASC' } });
    const attendances = await this.attendanceRepo.find({
      where: { date },
      relations: { student: true },
    });

    return students.map((student) => {
      const morning = attendances.find(
        (a) =>
          a.studentId === student.id &&
          a.session === AttendanceSession.MORNING,
      );
      const afternoon = attendances.find(
        (a) =>
          a.studentId === student.id &&
          a.session === AttendanceSession.AFTERNOON,
      );

      return {
        student,
        morning: morning || null,
        afternoon: afternoon || null,
      };
    });
  }

  /**
   * Lấy điểm danh theo khoảng ngày (dành cho admin)
   */
  async getAttendanceByDateRange(from: string, to: string) {
    const students = await this.studentRepo.find({ order: { orderNum: 'ASC' } });

    // Generate all dates in range
    const dates: string[] = [];
    const current = new Date(from);
    const end = new Date(to);
    while (current <= end) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, '0');
      const d = String(current.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }

    const attendances = await this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.date >= :from AND a.date <= :to', { from, to })
      .getMany();

    const settings = await this.getSettings();

    return {
      students,
      dates,
      attendances,
      schedule: settings.schedule || DEFAULT_SCHEDULE,
      today: getTodayVN(),
      currentTime: getCurrentTimeVN(),
      settings: {
        morningLateEnd: settings.morningLateEnd,
        afternoonLateEnd: settings.afternoonLateEnd,
        startDate: settings.startDate || getTodayVN(),
      },
    };
  }

  /**
   * Sửa trạng thái điểm danh thủ công (admin)
   */
  async updateAttendance(
    id: number,
    status: AttendanceStatus,
    note?: string,
  ) {
    const record = await this.attendanceRepo.findOneBy({ id });
    if (!record) throw new NotFoundException('Không tìm thấy bản ghi điểm danh');
    record.status = status;
    if (note !== undefined) record.note = note;
    return this.attendanceRepo.save(record);
  }

  /**
   * Thêm phép cho sinh viên (admin tạo bản ghi excused)
   */
  async addExcuse(
    studentId: number,
    date: string,
    session: AttendanceSession,
    note: string,
    status: AttendanceStatus = AttendanceStatus.EXCUSED,
  ) {
    const student = await this.studentRepo.findOneBy({ id: studentId });
    if (!student) throw new NotFoundException('Không tìm thấy sinh viên');

    // Xoá bản ghi cũ nếu có
    await this.attendanceRepo.delete({ studentId, date, session });

    const now = getVietnamNow();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const record = this.attendanceRepo.create({
      studentId,
      deviceId: `admin-${studentId}`,
      date,
      session,
      status: status || AttendanceStatus.EXCUSED,
      checkInTime: timeStr,
      note,
    });

    return this.attendanceRepo.save(record);
  }

  /**
   * Điểm danh hàng loạt cho tất cả sinh viên (xử lý server-side chỉ 1 request)
   */
  async markBulkAttendance(
    date: string,
    session: AttendanceSession | 'both',
    status: AttendanceStatus = AttendanceStatus.PRESENT,
  ) {
    const students = await this.studentRepo.find({ order: { orderNum: 'ASC' } });
    const sessions: AttendanceSession[] =
      session === 'both'
        ? [AttendanceSession.MORNING, AttendanceSession.AFTERNOON]
        : [session];

    const now = getVietnamNow();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    for (const sess of sessions) {
      for (const st of students) {
        let rec = await this.attendanceRepo.findOneBy({ studentId: st.id, date, session: sess });
        if (!rec) {
          rec = this.attendanceRepo.create({
            studentId: st.id,
            deviceId: `admin-${st.id}`,
            date,
            session: sess,
            status,
            checkInTime: timeStr,
          });
        } else {
          rec.status = status;
          if (!rec.checkInTime) rec.checkInTime = timeStr;
        }
        await this.attendanceRepo.save(rec);
      }
    }
    return {
      success: true,
      count: students.length * sessions.length,
      message: `Đã điểm danh cho ${students.length} sinh viên!`,
    };
  }

  /**
   * Xóa toàn bộ dữ liệu điểm danh (dành cho dọn rác test)
   */
  async clearAllAttendance() {
    await this.attendanceRepo.clear();
    return { success: true, message: 'Đã xóa toàn bộ lịch sử điểm danh test thành công!' };
  }

  /**
   * Xóa dữ liệu điểm danh của một ngày cụ thể
   */
  async clearAttendanceByDate(date: string) {
    await this.attendanceRepo.delete({ date });
    return { success: true, message: `Đã xóa dữ liệu điểm danh ngày ${date} thành công!` };
  }

  /**
   * Xóa một bản ghi điểm danh cụ thể theo ID
   */
  async deleteAttendanceRecord(id: number) {
    const res = await this.attendanceRepo.delete({ id });
    return { success: true, affected: res.affected, message: 'Đã xóa bản ghi điểm danh thành công!' };
  }

  /**
   * Lấy thông tin sinh viên đã liên kết với thiết bị này
   */
  async getDeviceBinding(deviceId: string) {
    if (!deviceId) return { bound: false, student: null };
    const student = await this.studentRepo.findOne({
      where: { deviceId },
      select: { id: true, orderNum: true, name: true, dob: true, deviceId: true },
    });
    return {
      bound: !!student,
      student: student || null,
    };
  }

  /**
   * Admin: Reset liên kết thiết bị của sinh viên để sinh viên đăng ký máy mới
   */
  async resetStudentDevice(studentId: number) {
    const student = await this.studentRepo.findOneBy({ id: studentId });
    if (!student) {
      throw new NotFoundException('Không tìm thấy sinh viên');
    }
    student.deviceId = null as any;
    await this.studentRepo.save(student);
    return {
      success: true,
      message: `Đã mở khóa thiết bị thành công cho sinh viên "${student.name}"!`,
    };
  }
}
