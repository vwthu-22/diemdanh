import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Student } from './entities/student.entity';
import { Attendance } from './entities/attendance.entity';
import { Settings } from './entities/settings.entity';
import { StudentsModule } from './modules/students/students.module';
import { AttendanceModule } from './modules/attendance/attendance.module';
import { AuthModule } from './modules/auth/auth.module';
import { SettingsModule } from './modules/settings/settings.module';
import { ExportModule } from './modules/export/export.module';
import { SeedModule } from './seed/seed.module';
import * as path from 'path';
import * as fs from 'fs';

// Ensure data directory exists
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        let databaseUrl = process.env.DATABASE_URL;
        if (databaseUrl) {
          // Remove channel_binding parameter as pg driver doesn't support it
          databaseUrl = databaseUrl.replace(/[?&]channel_binding=[^&]+/g, '');
          if (!databaseUrl.includes('?') && databaseUrl.includes('&')) {
            const firstAmp = databaseUrl.indexOf('&');
            databaseUrl = databaseUrl.slice(0, firstAmp) + '?' + databaseUrl.slice(firstAmp + 1);
          }

          return {
            type: 'postgres',
            url: databaseUrl,
            entities: [Student, Attendance, Settings],
            synchronize: true, // Auto-create tables in Postgres
            ssl: {
              rejectUnauthorized: false,
            },
            logging: false,
          };
        }

        return {
          type: 'better-sqlite3',
          database: path.join(process.cwd(), 'data', 'attendance.db'),
          entities: [Student, Attendance, Settings],
          synchronize: true, // Auto-create tables from entities
          logging: false,
        };
      },
    }),
    SeedModule,
    StudentsModule,
    AttendanceModule,
    AuthModule,
    SettingsModule,
    ExportModule,
  ],
})
export class AppModule {}
