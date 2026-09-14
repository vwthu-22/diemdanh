import { IsNumber, IsString, IsEnum, IsOptional, Min, Max } from 'class-validator';
import { AttendanceSession } from '../../../entities/attendance.entity';

export class CheckInDto {
  @IsNumber()
  studentId: number;

  @IsString()
  deviceId: string;

  @IsEnum(AttendanceSession)
  session: AttendanceSession;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;
}
