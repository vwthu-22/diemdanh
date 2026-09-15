import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Settings, DEFAULT_SCHEDULE } from '../../entities/settings.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Settings)
    private settingsRepo: Repository<Settings>,
  ) {}

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
      console.error('Error in updateSettings, applying fallback:', err);
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
