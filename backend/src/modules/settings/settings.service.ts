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
    let settings = await this.settingsRepo.findOne({ order: { id: 'ASC' } });
    if (!settings) {
      settings = this.settingsRepo.create({
        schedule: DEFAULT_SCHEDULE,
      });
      settings = await this.settingsRepo.save(settings);
    }
    if (!settings.schedule) {
      settings.schedule = DEFAULT_SCHEDULE;
    }
    return settings;
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
    return settings;
  }
}
