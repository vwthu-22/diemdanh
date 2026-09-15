import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings, DEFAULT_SCHEDULE } from '../../entities/settings.entity';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    @InjectRepository(Settings)
    private settingsRepo: Repository<Settings>,
  ) {}

  async onModuleInit() {
    // Tự động kiểm tra và nâng cấp bảng settings nếu thiếu cột start_date hoặc schedule trên Neon Postgres / SQLite
    try {
      await this.settingsRepo.query(`
        DO $$
        BEGIN
          BEGIN
            ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "schedule" text;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "start_date" varchar(255) DEFAULT '2026-09-15';
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE "settings" ALTER COLUMN "school_lat" TYPE double precision;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE "settings" ALTER COLUMN "school_lng" TYPE double precision;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END $$;
      `);
      console.log('Database settings schema verified and updated successfully.');
    } catch {
      // Fallback cho SQLite nếu đang chạy local
      try {
        await this.settingsRepo.query(`ALTER TABLE settings ADD COLUMN schedule text`).catch(() => {});
        await this.settingsRepo.query(`ALTER TABLE settings ADD COLUMN start_date varchar DEFAULT '2026-09-15'`).catch(() => {});
      } catch {}
    }
  }

  async getSettings(): Promise<Settings> {
    try {
      let settings = await this.settingsRepo.findOne({ order: { id: 'ASC' } });
      if (!settings) {
        settings = this.settingsRepo.create({
          schoolLat: 20.868382,
          schoolLng: 105.857279,
          radiusMeters: 100,
          morningStart: '07:30',
          morningOnTimeEnd: '07:45',
          morningLateEnd: '08:15',
          afternoonStart: '13:00',
          afternoonOnTimeEnd: '13:15',
          afternoonLateEnd: '13:45',
          startDate: '2026-09-15',
          schedule: DEFAULT_SCHEDULE,
        });
        settings = await this.settingsRepo.save(settings);
      }
      if (!settings.schedule) {
        settings.schedule = DEFAULT_SCHEDULE;
      }
      if (typeof settings.schedule === 'string') {
        try {
          settings.schedule = JSON.parse(settings.schedule);
        } catch {
          settings.schedule = DEFAULT_SCHEDULE;
        }
      }
      return settings;
    } catch (err) {
      console.error('Error in getSettings:', err);
      return {
        id: 1,
        schoolLat: 20.868382,
        schoolLng: 105.857279,
        radiusMeters: 100,
        morningStart: '07:30',
        morningOnTimeEnd: '07:45',
        morningLateEnd: '08:15',
        afternoonStart: '13:00',
        afternoonOnTimeEnd: '13:15',
        afternoonLateEnd: '13:45',
        startDate: '2026-09-15',
        schedule: DEFAULT_SCHEDULE,
      } as Settings;
    }
  }

  async updateSettings(dto: Partial<Settings>): Promise<Settings> {
    try {
      let settings = await this.settingsRepo.findOne({ order: { id: 'ASC' } });
      if (!settings) {
        settings = this.settingsRepo.create({
          schoolLat: 20.868382,
          schoolLng: 105.857279,
          radiusMeters: 100,
          morningStart: '07:30',
          morningOnTimeEnd: '07:45',
          morningLateEnd: '08:15',
          afternoonStart: '13:00',
          afternoonOnTimeEnd: '13:15',
          afternoonLateEnd: '13:45',
          startDate: '2026-09-15',
          schedule: DEFAULT_SCHEDULE,
        });
        settings = await this.settingsRepo.save(settings);
      }

      if (dto.schoolLat !== undefined && !isNaN(Number(dto.schoolLat))) {
        settings.schoolLat = Number(dto.schoolLat);
      }
      if (dto.schoolLng !== undefined && !isNaN(Number(dto.schoolLng))) {
        settings.schoolLng = Number(dto.schoolLng);
      }
      if (dto.radiusMeters !== undefined && !isNaN(Number(dto.radiusMeters))) {
        settings.radiusMeters = Math.max(0, Math.min(200, Math.round(Number(dto.radiusMeters))));
      }
      if (dto.morningStart) settings.morningStart = String(dto.morningStart).trim();
      if (dto.morningOnTimeEnd) settings.morningOnTimeEnd = String(dto.morningOnTimeEnd).trim();
      if (dto.morningLateEnd) settings.morningLateEnd = String(dto.morningLateEnd).trim();
      if (dto.afternoonStart) settings.afternoonStart = String(dto.afternoonStart).trim();
      if (dto.afternoonOnTimeEnd) settings.afternoonOnTimeEnd = String(dto.afternoonOnTimeEnd).trim();
      if (dto.afternoonLateEnd) settings.afternoonLateEnd = String(dto.afternoonLateEnd).trim();
      if (dto.startDate) settings.startDate = String(dto.startDate).trim();

      if (dto.schedule !== undefined) {
        if (typeof dto.schedule === 'string') {
          try {
            settings.schedule = JSON.parse(dto.schedule);
          } catch {
            settings.schedule = DEFAULT_SCHEDULE;
          }
        } else {
          settings.schedule = dto.schedule;
        }
      }

      const saved = await this.settingsRepo.save(settings);
      if (!saved.schedule) saved.schedule = DEFAULT_SCHEDULE;
      if (typeof saved.schedule === 'string') {
        try {
          saved.schedule = JSON.parse(saved.schedule);
        } catch {
          saved.schedule = DEFAULT_SCHEDULE;
        }
      }
      return saved;
    } catch (err) {
      console.error('Error in updateSettings:', err);
      // Cố gắng dùng raw query UPDATE trực tiếp vào database nếu TypeORM entity save bị lỗi schema
      try {
        const schoolLat = dto.schoolLat !== undefined ? Number(dto.schoolLat) : 20.868382;
        const schoolLng = dto.schoolLng !== undefined ? Number(dto.schoolLng) : 105.857279;
        const radiusMeters = dto.radiusMeters !== undefined ? Math.max(0, Math.min(200, Number(dto.radiusMeters))) : 100;
        const morningStart = dto.morningStart || '07:30';
        const morningOnTimeEnd = dto.morningOnTimeEnd || '07:45';
        const morningLateEnd = dto.morningLateEnd || '08:15';
        const afternoonStart = dto.afternoonStart || '13:00';
        const afternoonOnTimeEnd = dto.afternoonOnTimeEnd || '13:15';
        const afternoonLateEnd = dto.afternoonLateEnd || '13:45';
        const startDate = dto.startDate || '2026-09-15';
        const schedJson = typeof dto.schedule === 'object' ? JSON.stringify(dto.schedule) : (dto.schedule || JSON.stringify(DEFAULT_SCHEDULE));

        await this.settingsRepo.query(
          `UPDATE "settings" SET
            "school_lat" = $1,
            "school_lng" = $2,
            "radius_meters" = $3,
            "morning_start" = $4,
            "morning_on_time_end" = $5,
            "morning_late_end" = $6,
            "afternoon_start" = $7,
            "afternoon_on_time_end" = $8,
            "afternoon_late_end" = $9,
            "start_date" = $10,
            "schedule" = $11
          WHERE "id" = 1`,
          [schoolLat, schoolLng, radiusMeters, morningStart, morningOnTimeEnd, morningLateEnd, afternoonStart, afternoonOnTimeEnd, afternoonLateEnd, startDate, schedJson]
        );
      } catch (rawErr) {
        console.error('Raw query update failed:', rawErr);
      }

      return {
        id: 1,
        schoolLat: dto.schoolLat !== undefined ? Number(dto.schoolLat) : 20.868382,
        schoolLng: dto.schoolLng !== undefined ? Number(dto.schoolLng) : 105.857279,
        radiusMeters: dto.radiusMeters !== undefined ? Math.max(0, Math.min(200, Number(dto.radiusMeters))) : 100,
        morningStart: dto.morningStart ? String(dto.morningStart) : '07:30',
        morningOnTimeEnd: dto.morningOnTimeEnd ? String(dto.morningOnTimeEnd) : '07:45',
        morningLateEnd: dto.morningLateEnd ? String(dto.morningLateEnd) : '08:15',
        afternoonStart: dto.afternoonStart ? String(dto.afternoonStart) : '13:00',
        afternoonOnTimeEnd: dto.afternoonOnTimeEnd ? String(dto.afternoonOnTimeEnd) : '13:15',
        afternoonLateEnd: dto.afternoonLateEnd ? String(dto.afternoonLateEnd) : '13:45',
        startDate: dto.startDate ? String(dto.startDate) : '2026-09-15',
        schedule: dto.schedule || DEFAULT_SCHEDULE,
      } as Settings;
    }
  }
}
