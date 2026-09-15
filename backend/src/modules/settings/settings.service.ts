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
    await this.ensureSchema();
  }

  /**
   * Đảm bảo bảng settings có đầy đủ tất cả các cột và ít nhất 1 bản ghi cấu hình
   */
  private async ensureSchema() {
    // 1. Thử migration trên Postgres
    try {
      const postgresColumns = [
        `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "schedule" text`,
        `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "start_date" varchar(255) DEFAULT '2026-09-15'`,
        `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "school_lat" double precision DEFAULT 20.868382`,
        `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "school_lng" double precision DEFAULT 105.857279`,
        `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "radius_meters" integer DEFAULT 100`,
        `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "morning_start" varchar(255) DEFAULT '07:30'`,
        `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "morning_on_time_end" varchar(255) DEFAULT '07:45'`,
        `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "morning_late_end" varchar(255) DEFAULT '08:15'`,
        `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "afternoon_start" varchar(255) DEFAULT '13:00'`,
        `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "afternoon_on_time_end" varchar(255) DEFAULT '13:15'`,
        `ALTER TABLE "settings" ADD COLUMN IF NOT EXISTS "afternoon_late_end" varchar(255) DEFAULT '13:45'`,
      ];

      for (const query of postgresColumns) {
        await this.settingsRepo.query(query).catch(() => {});
      }

      // Đảm bảo có bản ghi id = 1
      await this.settingsRepo.query(`
        INSERT INTO "settings" ("school_lat", "school_lng", "radius_meters", "morning_start", "morning_on_time_end", "morning_late_end", "afternoon_start", "afternoon_on_time_end", "afternoon_late_end", "start_date", "schedule")
        SELECT 20.868382, 105.857279, 100, '07:30', '07:45', '08:15', '13:00', '13:15', '13:45', '2026-09-15', '${JSON.stringify(DEFAULT_SCHEDULE)}'
        WHERE NOT EXISTS (SELECT 1 FROM "settings");
      `).catch(() => {});
    } catch {
      // 2. Fallback cho SQLite
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

      return this.sanitizeSettings(settings);
    } catch (err) {
      console.error('Error in getSettings (trying raw fallback):', err);
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

      return this.getDefaultSettings();
    }
  }

  async updateSettings(dto: Partial<Settings>): Promise<Settings> {
    try {
      // 1. Chuẩn bị dữ liệu đầy đủ
      const current = await this.getSettings();
      const schoolLat = dto.schoolLat !== undefined && !isNaN(Number(dto.schoolLat)) ? Number(dto.schoolLat) : current.schoolLat;
      const schoolLng = dto.schoolLng !== undefined && !isNaN(Number(dto.schoolLng)) ? Number(dto.schoolLng) : current.schoolLng;
      const radiusMeters = dto.radiusMeters !== undefined && !isNaN(Number(dto.radiusMeters)) ? Math.max(0, Math.min(200, Math.round(Number(dto.radiusMeters)))) : current.radiusMeters;
      const morningStart = dto.morningStart ? String(dto.morningStart).trim() : current.morningStart;
      const morningOnTimeEnd = dto.morningOnTimeEnd ? String(dto.morningOnTimeEnd).trim() : current.morningOnTimeEnd;
      const morningLateEnd = dto.morningLateEnd ? String(dto.morningLateEnd).trim() : current.morningLateEnd;
      const afternoonStart = dto.afternoonStart ? String(dto.afternoonStart).trim() : current.afternoonStart;
      const afternoonOnTimeEnd = dto.afternoonOnTimeEnd ? String(dto.afternoonOnTimeEnd).trim() : current.afternoonOnTimeEnd;
      const afternoonLateEnd = dto.afternoonLateEnd ? String(dto.afternoonLateEnd).trim() : current.afternoonLateEnd;
      const startDate = dto.startDate ? String(dto.startDate).trim() : current.startDate;

      let scheduleObj = current.schedule || DEFAULT_SCHEDULE;
      if (dto.schedule !== undefined) {
        if (typeof dto.schedule === 'string') {
          try {
            scheduleObj = JSON.parse(dto.schedule);
          } catch {
            scheduleObj = DEFAULT_SCHEDULE;
          }
        } else {
          scheduleObj = dto.schedule;
        }
      }
      const scheduleStr = JSON.stringify(scheduleObj);

      // 2. Thử lưu bằng TypeORM Entity
      try {
        let entity = await this.settingsRepo.findOne({ order: { id: 'ASC' } });
        if (!entity) {
          entity = this.settingsRepo.create();
        }
        entity.schoolLat = schoolLat;
        entity.schoolLng = schoolLng;
        entity.radiusMeters = radiusMeters;
        entity.morningStart = morningStart;
        entity.morningOnTimeEnd = morningOnTimeEnd;
        entity.morningLateEnd = morningLateEnd;
        entity.afternoonStart = afternoonStart;
        entity.afternoonOnTimeEnd = afternoonOnTimeEnd;
        entity.afternoonLateEnd = afternoonLateEnd;
        entity.startDate = startDate;
        entity.schedule = scheduleObj;

        const saved = await this.settingsRepo.save(entity);
        return this.sanitizeSettings(saved);
      } catch (saveErr) {
        console.warn('TypeORM save failed, trying raw SQL update:', saveErr);
      }

      // 3. Fallback: Raw SQL Update trực tiếp vào PostgreSQL
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
          WHERE "id" = (SELECT "id" FROM "settings" ORDER BY "id" ASC LIMIT 1)`,
          [
            schoolLat,
            schoolLng,
            radiusMeters,
            morningStart,
            morningOnTimeEnd,
            morningLateEnd,
            afternoonStart,
            afternoonOnTimeEnd,
            afternoonLateEnd,
            startDate,
            scheduleStr,
          ],
        );
      } catch (pgErr) {
        // 4. Fallback: SQLite
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
            WHERE id = (SELECT id FROM settings ORDER BY id ASC LIMIT 1)`,
            [
              schoolLat,
              schoolLng,
              radiusMeters,
              morningStart,
              morningOnTimeEnd,
              morningLateEnd,
              afternoonStart,
              afternoonOnTimeEnd,
              afternoonLateEnd,
              startDate,
              scheduleStr,
            ],
          );
        } catch (sqliteErr) {
          console.error('All SQL update methods failed:', sqliteErr);
        }
      }

      return {
        id: current.id || 1,
        schoolLat,
        schoolLng,
        radiusMeters,
        morningStart,
        morningOnTimeEnd,
        morningLateEnd,
        afternoonStart,
        afternoonOnTimeEnd,
        afternoonLateEnd,
        startDate,
        schedule: scheduleObj,
      } as Settings;
    } catch (outerErr) {
      console.error('Fatal error in updateSettings:', outerErr);
      return this.getDefaultSettings();
    }
  }

  private sanitizeSettings(s: Settings): Settings {
    const res = { ...s };
    res.id = res.id || 1;
    res.schoolLat = isNaN(Number(res.schoolLat)) ? 20.868382 : Number(res.schoolLat);
    res.schoolLng = isNaN(Number(res.schoolLng)) ? 105.857279 : Number(res.schoolLng);
    res.radiusMeters = isNaN(Number(res.radiusMeters)) ? 100 : Math.max(0, Math.min(200, Number(res.radiusMeters)));
    res.morningStart = res.morningStart || '07:30';
    res.morningOnTimeEnd = res.morningOnTimeEnd || '07:45';
    res.morningLateEnd = res.morningLateEnd || '08:15';
    res.afternoonStart = res.afternoonStart || '13:00';
    res.afternoonOnTimeEnd = res.afternoonOnTimeEnd || '13:15';
    res.afternoonLateEnd = res.afternoonLateEnd || '13:45';
    res.startDate = res.startDate || '2026-09-15';

    if (!res.schedule) {
      res.schedule = DEFAULT_SCHEDULE;
    } else if (typeof res.schedule === 'string') {
      try {
        res.schedule = JSON.parse(res.schedule);
      } catch {
        res.schedule = DEFAULT_SCHEDULE;
      }
    }
    return res;
  }

  private getDefaultSettings(): Settings {
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
