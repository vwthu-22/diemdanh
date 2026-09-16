import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Attendance } from '../../entities/attendance.entity';
import { Student } from '../../entities/student.entity';
import { Settings } from '../../entities/settings.entity';
import { SettingsModule } from '../settings/settings.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Attendance, Student, Settings]),
    SettingsModule,
  ],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
