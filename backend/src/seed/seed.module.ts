import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from '../entities/student.entity';
import { Settings } from '../entities/settings.entity';
import { Attendance } from '../entities/attendance.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [TypeOrmModule.forFeature([Student, Settings, Attendance])],
  providers: [SeedService],
})
export class SeedModule {}
