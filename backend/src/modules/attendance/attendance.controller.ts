import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Query,
  Param,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './dto/checkin.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AttendanceStatus, AttendanceSession } from '../../entities/attendance.entity';

@Controller()
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  // ─── Public endpoints (sinh viên) ─────────────────────────────────────────

  @Get('attendance/session-status')
  getSessionStatus() {
    return this.attendanceService.getSessionStatus();
  }

  @Get('attendance/my-status')
  getMyStatus(@Query('deviceId') deviceId: string, @Query('date') date: string) {
    return this.attendanceService.getMyStatus(deviceId, date);
  }

  @Get('attendance/device-binding')
  getDeviceBinding(@Query('deviceId') deviceId: string) {
    return this.attendanceService.getDeviceBinding(deviceId);
  }

  @Post('attendance/checkin')
  checkIn(@Body(ValidationPipe) dto: CheckInDto) {
    return this.attendanceService.checkIn(dto);
  }

  // ─── Admin endpoints (cần JWT) ─────────────────────────────────────────────

  @UseGuards(JwtAuthGuard)
  @Get('admin/attendance')
  getAttendanceByDate(@Query('date') date: string) {
    return this.attendanceService.getAttendanceByDate(date);
  }

  @UseGuards(JwtAuthGuard)
  @Get('admin/attendance/range')
  getAttendanceByDateRange(
    @Query('from') from: string,
    @Query('to') to: string,
  ) {
    return this.attendanceService.getAttendanceByDateRange(from, to);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('admin/attendance/:id')
  updateAttendance(
    @Param('id') id: string,
    @Body() body: { status: AttendanceStatus; note?: string },
  ) {
    return this.attendanceService.updateAttendance(+id, body.status, body.note);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/excuse')
  addExcuse(
    @Body()
    body: {
      studentId: number;
      date: string;
      session: AttendanceSession;
      note: string;
      status?: AttendanceStatus;
    },
  ) {
    return this.attendanceService.addExcuse(
      body.studentId,
      body.date,
      body.session,
      body.note,
      body.status,
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/attendance/clear-all')
  clearAllAttendance() {
    return this.attendanceService.clearAllAttendance();
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/attendance/date')
  clearAttendanceByDate(@Query('date') date: string) {
    return this.attendanceService.clearAttendanceByDate(date);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('admin/attendance/:id')
  deleteAttendance(@Param('id') id: string) {
    return this.attendanceService.deleteAttendanceRecord(+id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('admin/students/:id/reset-device')
  resetStudentDevice(@Param('id') id: string) {
    return this.attendanceService.resetStudentDevice(+id);
  }
}
