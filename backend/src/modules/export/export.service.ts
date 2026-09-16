import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Attendance, AttendanceSession, AttendanceStatus } from '../../entities/attendance.entity';
import { Student } from '../../entities/student.entity';
import { Settings, DEFAULT_SCHEDULE } from '../../entities/settings.entity';
import { SettingsService } from '../settings/settings.service';
import { getTodayVN, getCurrentTimeVN, compareTime } from '../../utils/geo.util';

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PRESENT]: 'Có mặt',
  [AttendanceStatus.LATE]: 'Muộn',
  [AttendanceStatus.ABSENT]: 'Vắng',
  [AttendanceStatus.EXCUSED]: 'Có phép',
};

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  [AttendanceStatus.PRESENT]: 'FF22C55E',   // Green
  [AttendanceStatus.LATE]: 'FFF59E0B',       // Amber
  [AttendanceStatus.ABSENT]: 'FFEF4444',     // Red
  [AttendanceStatus.EXCUSED]: 'FF3B82F6',   // Blue
};

@Injectable()
export class ExportService {
  constructor(
    @InjectRepository(Attendance)
    private attendanceRepo: Repository<Attendance>,
    @InjectRepository(Student)
    private studentRepo: Repository<Student>,
    private settingsService: SettingsService,
  ) {}

  private getStatusLabel(status: AttendanceStatus | null | undefined): string {
    if (!status) return 'Vắng';
    return STATUS_LABELS[status] || 'Vắng';
  }

  private getStatusColor(status: AttendanceStatus | null | undefined): string {
    if (!status) return 'FFEF4444';
    return STATUS_COLORS[status] || 'FFEF4444';
  }

  private styleHeaderCell(cell: ExcelJS.Cell, text: string) {
    cell.value = text;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  }

  private styleDataCell(
    cell: ExcelJS.Cell,
    value: string,
    bgColor?: string,
    bold = false,
    align: 'left' | 'center' | 'right' = 'center',
  ) {
    cell.value = value;
    cell.font = { bold, size: 10, color: { argb: bgColor ? 'FFFFFFFF' : 'FF1F2937' } };
    if (bgColor) {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } };
    }
    cell.alignment = { horizontal: align, vertical: 'middle', wrapText: false };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
      right: { style: 'thin', color: { argb: 'FFD1D5DB' } },
    };
  }

  /**
   * Xuất Excel theo ngày
   */
  async exportDaily(date: string): Promise<Buffer> {
    const students = await this.studentRepo.find({ order: { orderNum: 'ASC' } });
    const attendances = await this.attendanceRepo.find({ where: { date } });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống Điểm danh CQP 22';
    const sheet = workbook.addWorksheet('Điểm danh ngày');

    // ── Title ──
    sheet.mergeCells('A1:I1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'ĐÀI TRUYỀN HÌNH VIỆT NAM - TRƯỜNG CAO ĐẲNG TRUYỀN HÌNH';
    titleCell.font = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 25;

    sheet.mergeCells('A2:I2');
    const dateCell = sheet.getCell('A2');
    const [y, m, d] = date.split('-');
    dateCell.value = `BẢNG ĐIỂM DANH LỚP CQP 22 - NGÀY ${d}/${m}/${y}`;
    dateCell.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    dateCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    dateCell.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 30;

    // ── Header row ──
    const headers = [
      { col: 'A', text: 'STT', width: 6 },
      { col: 'B', text: 'Họ và Tên', width: 26 },
      { col: 'C', text: 'Ngày sinh', width: 14 },
      { col: 'D', text: 'Giờ vào\n(Sáng)', width: 12 },
      { col: 'E', text: 'TT Sáng', width: 12 },
      { col: 'F', text: 'Giờ vào\n(Chiều)', width: 12 },
      { col: 'G', text: 'TT Chiều', width: 12 },
      { col: 'H', text: 'Tổng kết\nngày', width: 13 },
      { col: 'I', text: 'Ghi chú', width: 20 },
    ];

    headers.forEach(({ col, text, width }) => {
      const cell = sheet.getCell(`${col}3`);
      this.styleHeaderCell(cell, text);
      sheet.getColumn(col).width = width;
    });
    sheet.getRow(3).height = 35;

    // ── Data rows ──
    let present = 0, late = 0, absent = 0, excused = 0;

    students.forEach((student, idx) => {
      const rowNum = idx + 4;
      const morningRec = attendances.find(
        (a) => a.studentId === student.id && a.session === AttendanceSession.MORNING,
      );
      const afternoonRec = attendances.find(
        (a) => a.studentId === student.id && a.session === AttendanceSession.AFTERNOON,
      );

      const morningStatus = morningRec?.status ?? null;
      const afternoonStatus = afternoonRec?.status ?? null;

      // Determine daily summary
      let dailyStatus: AttendanceStatus;
      if (morningStatus === AttendanceStatus.LATE || afternoonStatus === AttendanceStatus.LATE) {
        dailyStatus = AttendanceStatus.LATE;
      } else if (morningStatus === AttendanceStatus.PRESENT || afternoonStatus === AttendanceStatus.PRESENT) {
        dailyStatus = AttendanceStatus.PRESENT;
      } else if (morningStatus === AttendanceStatus.EXCUSED || afternoonStatus === AttendanceStatus.EXCUSED) {
        dailyStatus = AttendanceStatus.EXCUSED;
      } else {
        dailyStatus = AttendanceStatus.ABSENT;
      }

      if (dailyStatus === AttendanceStatus.PRESENT) present++;
      else if (dailyStatus === AttendanceStatus.LATE) late++;
      else if (dailyStatus === AttendanceStatus.EXCUSED) excused++;
      else absent++;

      const bgAlternate = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';

      const row = sheet.getRow(rowNum);

      // STT
      const sttCell = sheet.getCell(`A${rowNum}`);
      this.styleDataCell(sttCell, String(student.orderNum));
      sttCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAlternate } };
      sttCell.font = { ...sttCell.font, color: { argb: 'FF374151' } };

      // Name
      const nameCell = sheet.getCell(`B${rowNum}`);
      this.styleDataCell(nameCell, student.name, undefined, false, 'left');
      nameCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAlternate } };
      nameCell.font = { ...nameCell.font, color: { argb: 'FF111827' } };

      // Ngày sinh
      const dobCell = sheet.getCell(`C${rowNum}`);
      this.styleDataCell(dobCell, student.dob || '—', undefined, false, 'center');
      dobCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAlternate } };
      dobCell.font = { ...dobCell.font, color: { argb: 'FF374151' } };

      // Morning check-in time
      this.styleDataCell(
        sheet.getCell(`D${rowNum}`),
        morningRec?.checkInTime ? morningRec.checkInTime.substring(0, 5) : '--',
        morningStatus ? undefined : undefined,
      );
      sheet.getCell(`D${rowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAlternate } };
      sheet.getCell(`D${rowNum}`).font = { size: 10, color: { argb: 'FF374151' } };

      // Morning status
      this.styleDataCell(
        sheet.getCell(`E${rowNum}`),
        this.getStatusLabel(morningStatus),
        this.getStatusColor(morningStatus),
        true,
      );

      // Afternoon check-in time
      this.styleDataCell(
        sheet.getCell(`F${rowNum}`),
        afternoonRec?.checkInTime ? afternoonRec.checkInTime.substring(0, 5) : '--',
      );
      sheet.getCell(`F${rowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAlternate } };
      sheet.getCell(`F${rowNum}`).font = { size: 10, color: { argb: 'FF374151' } };

      // Afternoon status
      this.styleDataCell(
        sheet.getCell(`G${rowNum}`),
        this.getStatusLabel(afternoonStatus),
        this.getStatusColor(afternoonStatus),
        true,
      );

      // Daily summary
      this.styleDataCell(
        sheet.getCell(`H${rowNum}`),
        this.getStatusLabel(dailyStatus),
        this.getStatusColor(dailyStatus),
        true,
      );

      // Note
      const note = morningRec?.note || afternoonRec?.note || '';
      this.styleDataCell(sheet.getCell(`I${rowNum}`), note, undefined, false, 'left');
      sheet.getCell(`I${rowNum}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAlternate } };
      sheet.getCell(`I${rowNum}`).font = { size: 10, color: { argb: 'FF374151' } };

      row.height = 22;
    });

    // ── Summary section ──
    const summaryRow = students.length + 5;
    sheet.mergeCells(`A${summaryRow}:B${summaryRow}`);
    const summaryTitleCell = sheet.getCell(`A${summaryRow}`);
    summaryTitleCell.value = 'TỔNG KẾT';
    summaryTitleCell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
    summaryTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF374151' } };
    summaryTitleCell.alignment = { horizontal: 'center' };

    const summaryData = [
      { label: `Có mặt`, value: present, color: STATUS_COLORS[AttendanceStatus.PRESENT] },
      { label: `Muộn`, value: late, color: STATUS_COLORS[AttendanceStatus.LATE] },
      { label: `Vắng`, value: absent, color: STATUS_COLORS[AttendanceStatus.ABSENT] },
      { label: `Có phép`, value: excused, color: STATUS_COLORS[AttendanceStatus.EXCUSED] },
    ];

    summaryData.forEach((item, i) => {
      const r = summaryRow + 1 + i;
      sheet.mergeCells(`A${r}:B${r}`);
      this.styleDataCell(sheet.getCell(`A${r}`), item.label, item.color, true);
      this.styleDataCell(sheet.getCell(`C${r}`), `${item.value} / ${students.length}`, item.color, true);
      this.styleDataCell(sheet.getCell(`D${r}`), `${((item.value / students.length) * 100).toFixed(1)}%`, item.color, true);
    });

    // Freeze panes
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 3 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Xuất Excel theo tuần (ma trận)
   */
  async exportWeekly(from: string, to: string): Promise<Buffer> {
    const students = await this.studentRepo.find({ order: { orderNum: 'ASC' } });

    // Generate dates
    const dates: string[] = [];
    const cur = new Date(from);
    const end = new Date(to);
    while (cur <= end) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
      cur.setDate(cur.getDate() + 1);
    }

    const attendances = await this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.date >= :from AND a.date <= :to', { from, to })
      .getMany();

    const settings = await this.settingsService.getSettings();
    const schedule = settings.schedule || DEFAULT_SCHEDULE;
    const today = getTodayVN();
    const currentTime = getCurrentTimeVN();
    const startDate = settings.startDate || today;
    const morningLateEnd = settings.morningLateEnd || '08:15';
    const afternoonLateEnd = settings.afternoonLateEnd || '13:45';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Tổng hợp tuần');

    const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    // ── Title ──
    const totalCols = 3 + dates.length * 2 + 4;
    sheet.mergeCells(1, 1, 1, totalCols);
    const t1 = sheet.getCell(1, 1);
    t1.value = 'ĐÀI TRUYỀN HÌNH VIỆT NAM - TRƯỜNG CAO ĐẲNG TRUYỀN HÌNH';
    t1.font = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };
    t1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 25;

    sheet.mergeCells(2, 1, 2, totalCols);
    const t2 = sheet.getCell(2, 1);
    const [fy, fm, fd] = from.split('-');
    const [ty, tm, td] = to.split('-');
    t2.value = `BẢNG TỔNG HỢP ĐIỂM DANH LỚP CQP 22 (${fd}/${fm}/${fy} - ${td}/${tm}/${ty})`;
    t2.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    t2.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 30;

    // ── Header Row 1: Date headers ──
    sheet.getCell(3, 1).value = 'STT';
    this.styleHeaderCell(sheet.getCell(3, 1), 'STT');
    sheet.getColumn(1).width = 5;

    sheet.getCell(3, 2).value = 'Họ và Tên';
    this.styleHeaderCell(sheet.getCell(3, 2), 'Họ và Tên');
    sheet.getColumn(2).width = 24;

    sheet.getCell(3, 3).value = 'Ngày sinh';
    this.styleHeaderCell(sheet.getCell(3, 3), 'Ngày sinh');
    sheet.getColumn(3).width = 14;

    let col = 4;
    dates.forEach((date, i) => {
      const dateObj = new Date(date);
      const dayName = DAY_NAMES[dateObj.getDay()];
      const [, dm, dd] = date.split('-');
      sheet.mergeCells(3, col, 3, col + 1);
      this.styleHeaderCell(sheet.getCell(3, col), `${dayName}\n${dd}/${dm}`);
      sheet.getCell(3, col).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      sheet.getColumn(col).width = 7;
      sheet.getColumn(col + 1).width = 7;
      col += 2;
    });

    // Summary headers
    ['Có mặt', 'Muộn', 'Vắng', 'Có phép'].forEach((label, i) => {
      this.styleHeaderCell(sheet.getCell(3, col + i), label);
      sheet.getColumn(col + i).width = 8;
    });
    sheet.getRow(3).height = 35;

    // ── Header Row 2: S/C sub-headers ──
    // STT, Name, and DOB span 2 rows
    sheet.mergeCells(3, 1, 4, 1);
    sheet.mergeCells(3, 2, 4, 2);
    sheet.mergeCells(3, 3, 4, 3);
    const summaryStartCol = 4 + dates.length * 2;
    sheet.mergeCells(3, summaryStartCol, 4, summaryStartCol);
    sheet.mergeCells(3, summaryStartCol + 1, 4, summaryStartCol + 1);
    sheet.mergeCells(3, summaryStartCol + 2, 4, summaryStartCol + 2);
    sheet.mergeCells(3, summaryStartCol + 3, 4, summaryStartCol + 3);

    let col2 = 4;
    dates.forEach(() => {
      this.styleHeaderCell(sheet.getCell(4, col2), 'S');
      this.styleHeaderCell(sheet.getCell(4, col2 + 1), 'C');
      col2 += 2;
    });
    sheet.getRow(4).height = 20;

    // ── Data Rows ──
    students.forEach((student, idx) => {
      const rowNum = idx + 5;
      let cntPresent = 0, cntLate = 0, cntAbsent = 0, cntExcused = 0;
      const bgAlternate = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';

      // STT
      this.styleDataCell(sheet.getCell(rowNum, 1), String(student.orderNum));
      sheet.getCell(rowNum, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAlternate } };
      sheet.getCell(rowNum, 1).font = { size: 10, color: { argb: 'FF374151' } };

      // Name
      this.styleDataCell(sheet.getCell(rowNum, 2), student.name, undefined, false, 'left');
      sheet.getCell(rowNum, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAlternate } };
      sheet.getCell(rowNum, 2).font = { size: 10, color: { argb: 'FF111827' } };

      // Ngày sinh
      this.styleDataCell(sheet.getCell(rowNum, 3), student.dob || '—', undefined, false, 'center');
      sheet.getCell(rowNum, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAlternate } };
      sheet.getCell(rowNum, 3).font = { size: 10, color: { argb: 'FF374151' } };

      let dataCol = 4;
      dates.forEach((date) => {
        const morningRec = attendances.find(
          (a) => a.studentId === student.id && a.date === date && a.session === AttendanceSession.MORNING,
        );
        const afternoonRec = attendances.find(
          (a) => a.studentId === student.id && a.date === date && a.session === AttendanceSession.AFTERNOON,
        );

        const dateObj = new Date(date);
        const dow = String(dateObj.getDay());
        const morningScheduled = schedule[dow]?.includes('morning') ?? true;
        const afternoonScheduled = schedule[dow]?.includes('afternoon') ?? true;

        const isPastStart = date >= startDate;
        const isMorningPassed = isPastStart && (date < today || (date === today && compareTime(currentTime, morningLateEnd) > 0));
        const isAfternoonPassed = isPastStart && (date < today || (date === today && compareTime(currentTime, afternoonLateEnd) > 0));

        // Morning session
        let mLabel = '–';
        let mColor: string | undefined = undefined;
        if (morningRec) {
          mLabel = morningRec.status === AttendanceStatus.PRESENT ? '✓'
            : morningRec.status === AttendanceStatus.LATE ? 'M'
            : morningRec.status === AttendanceStatus.EXCUSED ? 'P' : '✗';
          mColor = this.getStatusColor(morningRec.status);
          if (morningRec.status === AttendanceStatus.PRESENT) cntPresent++;
          else if (morningRec.status === AttendanceStatus.LATE) cntLate++;
          else if (morningRec.status === AttendanceStatus.EXCUSED) cntExcused++;
          else if (morningRec.status === AttendanceStatus.ABSENT) cntAbsent++;
        } else if (morningScheduled && isMorningPassed) {
          // Scheduled session has ended but student was not checked in -> VẮNG!
          mLabel = '✗';
          mColor = STATUS_COLORS[AttendanceStatus.ABSENT];
          cntAbsent++;
        }

        // Afternoon session
        let aLabel = '–';
        let aColor: string | undefined = undefined;
        if (afternoonRec) {
          aLabel = afternoonRec.status === AttendanceStatus.PRESENT ? '✓'
            : afternoonRec.status === AttendanceStatus.LATE ? 'M'
            : afternoonRec.status === AttendanceStatus.EXCUSED ? 'P' : '✗';
          aColor = this.getStatusColor(afternoonRec.status);
          if (afternoonRec.status === AttendanceStatus.PRESENT) cntPresent++;
          else if (afternoonRec.status === AttendanceStatus.LATE) cntLate++;
          else if (afternoonRec.status === AttendanceStatus.EXCUSED) cntExcused++;
          else if (afternoonRec.status === AttendanceStatus.ABSENT) cntAbsent++;
        } else if (afternoonScheduled && isAfternoonPassed) {
          // Scheduled session has ended but student was not checked in -> VẮNG!
          aLabel = '✗';
          aColor = STATUS_COLORS[AttendanceStatus.ABSENT];
          cntAbsent++;
        }

        this.styleDataCell(sheet.getCell(rowNum, dataCol), mLabel, mColor, mLabel !== '–');
        this.styleDataCell(sheet.getCell(rowNum, dataCol + 1), aLabel, aColor, aLabel !== '–');

        dataCol += 2;
      });

      // Summary counts
      this.styleDataCell(sheet.getCell(rowNum, dataCol), String(cntPresent), STATUS_COLORS[AttendanceStatus.PRESENT], true);
      this.styleDataCell(sheet.getCell(rowNum, dataCol + 1), String(cntLate), STATUS_COLORS[AttendanceStatus.LATE], true);
      this.styleDataCell(sheet.getCell(rowNum, dataCol + 2), String(cntAbsent), STATUS_COLORS[AttendanceStatus.ABSENT], true);
      this.styleDataCell(sheet.getCell(rowNum, dataCol + 3), String(cntExcused), STATUS_COLORS[AttendanceStatus.EXCUSED], true);

      sheet.getRow(rowNum).height = 20;
    });

    // Freeze panes
    sheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }

  /**
   * Xuất Excel theo tháng (ma trận toàn bộ các ngày trong tháng)
   */
  async exportMonthly(month: string): Promise<Buffer> {
    const [yStr, mStr] = month.split('-');
    const year = parseInt(yStr);
    const monthNum = parseInt(mStr);
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    const from = `${month}-01`;
    const to = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    const students = await this.studentRepo.find({ order: { orderNum: 'ASC' } });

    // Generate dates
    const dates: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const d = String(day).padStart(2, '0');
      dates.push(`${month}-${d}`);
    }

    const attendances = await this.attendanceRepo
      .createQueryBuilder('a')
      .where('a.date >= :from AND a.date <= :to', { from, to })
      .getMany();

    const settings = await this.settingsService.getSettings();
    const schedule = settings.schedule || DEFAULT_SCHEDULE;
    const today = getTodayVN();
    const currentTime = getCurrentTimeVN();
    const startDate = settings.startDate || today;
    const morningLateEnd = settings.morningLateEnd || '08:15';
    const afternoonLateEnd = settings.afternoonLateEnd || '13:45';

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(`Tháng ${mStr}-${yStr}`);

    const DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

    // ── Title ──
    const totalCols = 3 + dates.length * 2 + 5;
    sheet.mergeCells(1, 1, 1, totalCols);
    const t1 = sheet.getCell(1, 1);
    t1.value = 'ĐÀI TRUYỀN HÌNH VIỆT NAM - TRƯỜNG CAO ĐẲNG TRUYỀN HÌNH';
    t1.font = { bold: true, size: 13, color: { argb: 'FF1E3A5F' } };
    t1.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 25;

    sheet.mergeCells(2, 1, 2, totalCols);
    const t2 = sheet.getCell(2, 1);
    t2.value = `BẢNG TỔNG HỢP ĐIỂM DANH LỚP CQP 22 - THÁNG ${mStr}/${yStr}`;
    t2.font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    t2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    t2.alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(2).height = 30;

    // ── Header Row 1: Date headers ──
    sheet.getCell(3, 1).value = 'STT';
    this.styleHeaderCell(sheet.getCell(3, 1), 'STT');
    sheet.getColumn(1).width = 5;

    sheet.getCell(3, 2).value = 'Họ và Tên';
    this.styleHeaderCell(sheet.getCell(3, 2), 'Họ và Tên');
    sheet.getColumn(2).width = 24;

    sheet.getCell(3, 3).value = 'Ngày sinh';
    this.styleHeaderCell(sheet.getCell(3, 3), 'Ngày sinh');
    sheet.getColumn(3).width = 14;

    let col = 4;
    dates.forEach((date) => {
      const dateObj = new Date(date);
      const dayName = DAY_NAMES[dateObj.getDay()];
      const [, dm, dd] = date.split('-');
      sheet.mergeCells(3, col, 3, col + 1);
      this.styleHeaderCell(sheet.getCell(3, col), `${dayName}\n${dd}/${dm}`);
      sheet.getCell(3, col).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      sheet.getColumn(col).width = 6;
      sheet.getColumn(col + 1).width = 6;
      col += 2;
    });

    // Summary headers
    ['Có mặt', 'Muộn', 'Vắng', 'Có phép', 'Chuyên cần'].forEach((label, i) => {
      this.styleHeaderCell(sheet.getCell(3, col + i), label);
      sheet.getColumn(col + i).width = i === 4 ? 12 : 8;
    });
    sheet.getRow(3).height = 35;

    // ── Header Row 2: S/C sub-headers ──
    sheet.mergeCells(3, 1, 4, 1);
    sheet.mergeCells(3, 2, 4, 2);
    sheet.mergeCells(3, 3, 4, 3);
    const summaryStartCol = 4 + dates.length * 2;
    sheet.mergeCells(3, summaryStartCol, 4, summaryStartCol);
    sheet.mergeCells(3, summaryStartCol + 1, 4, summaryStartCol + 1);
    sheet.mergeCells(3, summaryStartCol + 2, 4, summaryStartCol + 2);
    sheet.mergeCells(3, summaryStartCol + 3, 4, summaryStartCol + 3);
    sheet.mergeCells(3, summaryStartCol + 4, 4, summaryStartCol + 4);

    let col2 = 4;
    dates.forEach(() => {
      this.styleHeaderCell(sheet.getCell(4, col2), 'S');
      this.styleHeaderCell(sheet.getCell(4, col2 + 1), 'C');
      col2 += 2;
    });
    sheet.getRow(4).height = 20;

    // ── Data Rows ──
    students.forEach((student, idx) => {
      const rowNum = idx + 5;
      let cntPresent = 0, cntLate = 0, cntAbsent = 0, cntExcused = 0;
      let totalScheduled = 0;
      const bgAlternate = idx % 2 === 0 ? 'FFF8FAFC' : 'FFFFFFFF';

      // STT
      this.styleDataCell(sheet.getCell(rowNum, 1), String(student.orderNum));
      sheet.getCell(rowNum, 1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAlternate } };
      sheet.getCell(rowNum, 1).font = { size: 10, color: { argb: 'FF374151' } };

      // Name
      this.styleDataCell(sheet.getCell(rowNum, 2), student.name, undefined, false, 'left');
      sheet.getCell(rowNum, 2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAlternate } };
      sheet.getCell(rowNum, 2).font = { size: 10, color: { argb: 'FF111827' } };

      // Ngày sinh
      this.styleDataCell(sheet.getCell(rowNum, 3), student.dob || '—', undefined, false, 'center');
      sheet.getCell(rowNum, 3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgAlternate } };
      sheet.getCell(rowNum, 3).font = { size: 10, color: { argb: 'FF374151' } };

      let dataCol = 4;
      dates.forEach((date) => {
        const morningRec = attendances.find(
          (a) => a.studentId === student.id && a.date === date && a.session === AttendanceSession.MORNING,
        );
        const afternoonRec = attendances.find(
          (a) => a.studentId === student.id && a.date === date && a.session === AttendanceSession.AFTERNOON,
        );

        const dateObj = new Date(date);
        const dow = String(dateObj.getDay());
        const morningScheduled = schedule[dow]?.includes('morning') ?? true;
        const afternoonScheduled = schedule[dow]?.includes('afternoon') ?? true;

        const isPastStart = date >= startDate;
        if (isPastStart) {
          if (morningScheduled) totalScheduled++;
          if (afternoonScheduled) totalScheduled++;
        }

        const isMorningPassed = isPastStart && (date < today || (date === today && compareTime(currentTime, morningLateEnd) > 0));
        const isAfternoonPassed = isPastStart && (date < today || (date === today && compareTime(currentTime, afternoonLateEnd) > 0));

        // Morning session
        let mLabel = '–';
        let mColor: string | undefined = undefined;
        if (morningRec) {
          mLabel = morningRec.status === AttendanceStatus.PRESENT ? '✓'
            : morningRec.status === AttendanceStatus.LATE ? 'M'
            : morningRec.status === AttendanceStatus.EXCUSED ? 'P' : '✗';
          mColor = this.getStatusColor(morningRec.status);
          if (morningRec.status === AttendanceStatus.PRESENT) cntPresent++;
          else if (morningRec.status === AttendanceStatus.LATE) cntLate++;
          else if (morningRec.status === AttendanceStatus.EXCUSED) cntExcused++;
          else if (morningRec.status === AttendanceStatus.ABSENT) cntAbsent++;
        } else if (morningScheduled && isMorningPassed) {
          mLabel = '✗';
          mColor = STATUS_COLORS[AttendanceStatus.ABSENT];
          cntAbsent++;
        }

        // Afternoon session
        let aLabel = '–';
        let aColor: string | undefined = undefined;
        if (afternoonRec) {
          aLabel = afternoonRec.status === AttendanceStatus.PRESENT ? '✓'
            : afternoonRec.status === AttendanceStatus.LATE ? 'M'
            : afternoonRec.status === AttendanceStatus.EXCUSED ? 'P' : '✗';
          aColor = this.getStatusColor(afternoonRec.status);
          if (afternoonRec.status === AttendanceStatus.PRESENT) cntPresent++;
          else if (afternoonRec.status === AttendanceStatus.LATE) cntLate++;
          else if (afternoonRec.status === AttendanceStatus.EXCUSED) cntExcused++;
          else if (afternoonRec.status === AttendanceStatus.ABSENT) cntAbsent++;
        } else if (afternoonScheduled && isAfternoonPassed) {
          aLabel = '✗';
          aColor = STATUS_COLORS[AttendanceStatus.ABSENT];
          cntAbsent++;
        }

        this.styleDataCell(sheet.getCell(rowNum, dataCol), mLabel, mColor, mLabel !== '–');
        this.styleDataCell(sheet.getCell(rowNum, dataCol + 1), aLabel, aColor, aLabel !== '–');

        dataCol += 2;
      });

      // Summary counts
      this.styleDataCell(sheet.getCell(rowNum, dataCol), String(cntPresent), STATUS_COLORS[AttendanceStatus.PRESENT], true);
      this.styleDataCell(sheet.getCell(rowNum, dataCol + 1), String(cntLate), STATUS_COLORS[AttendanceStatus.LATE], true);
      this.styleDataCell(sheet.getCell(rowNum, dataCol + 2), String(cntAbsent), STATUS_COLORS[AttendanceStatus.ABSENT], true);
      this.styleDataCell(sheet.getCell(rowNum, dataCol + 3), String(cntExcused), STATUS_COLORS[AttendanceStatus.EXCUSED], true);

      // Chuyên cần (%)
      const rate = totalScheduled > 0 ? Math.round(((cntPresent + cntLate * 0.8) / totalScheduled) * 100) : 100;
      const rateColor = rate >= 90 ? STATUS_COLORS[AttendanceStatus.PRESENT] : rate >= 70 ? STATUS_COLORS[AttendanceStatus.LATE] : STATUS_COLORS[AttendanceStatus.ABSENT];
      this.styleDataCell(sheet.getCell(rowNum, dataCol + 4), `${rate}%`, rateColor, true);

      sheet.getRow(rowNum).height = 20;
    });

    // Freeze panes
    sheet.views = [{ state: 'frozen', xSplit: 3, ySplit: 4 }];

    const buffer = await workbook.xlsx.writeBuffer();
    return Buffer.from(buffer);
  }
}
