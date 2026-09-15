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
          radiusMeters: 50000,
          morningStart: '07:30',
          morningOnTimeEnd: '07:45',
          morningLateEnd: '08:15',
          afternoonStart: '13:00',
          afternoonOnTimeEnd: '13:15',
          afternoonLateEnd: '13:45',
          startDate: '2026-09-14',
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
        radiusMeters: 50000,
        morningStart: '07:30',
        morningOnTimeEnd: '07:45',
        morningLateEnd: '08:15',
        afternoonStart: '13:00',
        afternoonOnTimeEnd: '13:15',
        afternoonLateEnd: '13:45',
        startDate: '2026-09-14',
        schedule: DEFAULT_SCHEDULE,
      } as Settings;
    }
  }

  async updateSettings(dto: Partial<Settings>): Promise<Settings> {
    let settings = await this.settingsRepo.findOne({ order: { id: 'ASC' } });
    if (!settings) {
      settings = this.settingsRepo.create(dto);
    } else {
      const { id, ...updateData } = dto as any;
      Object.assign(settings, updateData);
    }
    settings = await this.settingsRepo.save(settings);
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
  }
}
