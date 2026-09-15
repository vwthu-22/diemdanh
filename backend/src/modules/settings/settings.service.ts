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
            ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "school_lat" double precision DEFAULT 20.868382;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "school_lng" double precision DEFAULT 105.857279;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "radius_meters" integer DEFAULT 100;
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "morning_start" varchar(255) DEFAULT '07:30';
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "morning_on_time_end" varchar(255) DEFAULT '07:45';
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "morning_late_end" varchar(255) DEFAULT '08:15';
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "afternoon_start" varchar(255) DEFAULT '13:00';
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "afternoon_on_time_end" varchar(255) DEFAULT '13:15';
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
          BEGIN
            ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "afternoon_late_end" varchar(255) DEFAULT '13:45';
          EXCEPTION WHEN OTHERS THEN NULL;
          END;
        END $$;
      `);
      console.log('Postgres settings schema verified and updated successfully.');
    } catch {
      // Fallback cho SQLite nếu đang chạy local
      try {
        await this.settingsRepo.query(`ALTER TABLE settings ADD COLUMN schedule text`).catch(() => {});
        await this.settingsRepo.query(`ALTER TABLE settings ADD COLUMN start_date varchar DEFAULT '2026-09-15'`).catch(() => {});
      } catch {}
    }

    // Đảm bảo có ít nhất 1 bản ghi cấu hình trong bảng settings
    try {
      const count = await this.settingsRepo.count();
      if (count === 0) {
        const initial = this.settingsRepo.create({
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
        await this.settingsRepo.save(initial);
        console.log('Seeded default settings record.');
      }
    } catch (e) {
      console.error('Error ensuring settings record exists:', e);
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

      // Format & sanitize types
      settings.schoolLat = isNaN(Number(settings.schoolLat)) ? 20.868382 : Number(settings.schoolLat);
      settings.schoolLng = isNaN(Number(settings.schoolLng)) ? 105.857279 : Number(settings.schoolLng);
      settings.radiusMeters = isNaN(Number(settings.radiusMeters)) ? 100 : Math.max(0, Math.min(200, Number(settings.radiusMeters)));
      settings.morningStart = settings.morningStart || '07:30';
      settings.morningOnTimeEnd = settings.morningOnTimeEnd || '07:45';
      settings.morningLateEnd = settings.morningLateEnd || '08:15';
      settings.afternoonStart = settings.afternoonStart || '13:00';
      settings.afternoonOnTimeEnd = settings.afternoonOnTimeEnd || '13:15';
      settings.afternoonLateEnd = settings.afternoonLateEnd || '13:45';
      settings.startDate = settings.startDate || '2026-09-15';

      if (!settings.schedule) {
        settings.schedule = DEFAULT_SCHEDULE;
      } else if (typeof settings.schedule === 'string') {
        try {
          settings.schedule = JSON.parse(settings.schedule);
        } catch {
          settings.schedule = DEFAULT_SCHEDULE;
        }
      }

      return settings;
    } catch (err) {
      console.error('Error in getSettings, attempting raw query fallback:', err);
      try {
        const rows = await this.settingsRepo.query(`SELECT * FROM "settings" ORDER BY "id" ASC LIMIT 1`);
        if (rows && rows.length > 0) {
          const row = rows[0];
          let sched = DEFAULT_SCHEDULE;
          if (row.schedule) {
            try {
              sched = typeof row.schedule === 'string' ? JSON.parse(row.schedule) : row.schedule;
            } catch {}
          }
          return {
            id: row.id || 1,
            schoolLat: Number(row.school_lat ?? 20.868382),
            schoolLng: Number(row.school_lng ?? 105.857279),
            radiusMeters: Number(row.radius_meters ?? 100),
            morningStart: row.morning_start || '07:30',
            morningOnTimeEnd: row.morning_on_time_end || '07:45',
            morningLateEnd: row.morning_late_end || '08:15',
            afternoonStart: row.afternoon_start || '13:00',
            afternoonOnTimeEnd: row.afternoon_on_time_end || '13:15',
            afternoonLateEnd: row.afternoon_late_end || '13:45',
            startDate: row.start_date || '2026-09-15',
            schedule: sched,
          } as Settings;
        }
      } catch (rawErr) {
        console.error('Raw query fallback in getSettings failed:', rawErr);
      }

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

    try {
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
      console.error('Error in settingsRepo.save, trying raw UPDATE:', err);
      const targetId = settings.id || 1;
      const schedStr = typeof settings.schedule === 'object' ? JSON.stringify(settings.schedule) : (settings.schedule || JSON.stringify(DEFAULT_SCHEDULE));

      try {
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
          WHERE "id" = $12`,
          [
            settings.schoolLat,
            settings.schoolLng,
            settings.radiusMeters,
            settings.morningStart,
            settings.morningOnTimeEnd,
            settings.morningLateEnd,
            settings.afternoonStart,
            settings.afternoonOnTimeEnd,
            settings.afternoonLateEnd,
            settings.startDate,
            schedStr,
            targetId,
          ],
        );
      } catch (rawErr) {
        console.error('Raw query update failed, trying SQLite format:', rawErr);
        try {
          await this.settingsRepo.query(
            `UPDATE settings SET
              school_lat = ?,
              school_lng = ?,
              radius_meters = ?,
              morning_start = ?,
              morning_on_time_end = ?,
              morning_late_end = ?,
              afternoon_start = ?,
              afternoon_on_time_end = ?,
              afternoon_late_end = ?,
              start_date = ?,
              schedule = ?
            WHERE id = ?`,
            [
              settings.schoolLat,
              settings.schoolLng,
              settings.radiusMeters,
              settings.morningStart,
              settings.morningOnTimeEnd,
              settings.morningLateEnd,
              settings.afternoonStart,
              settings.afternoonOnTimeEnd,
              settings.afternoonLateEnd,
              settings.startDate,
              schedStr,
              targetId,
            ],
          );
        } catch (sqliteErr) {
          console.error('SQLite fallback query update also failed:', sqliteErr);
        }
      }

      return settings;
    }
  }
}
