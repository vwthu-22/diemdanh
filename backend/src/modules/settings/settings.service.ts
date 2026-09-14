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

  async getSettings(): Promise<Settings | null> {
    const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (settings && !settings.schedule) {
      settings.schedule = DEFAULT_SCHEDULE;
    }
    return settings;
  }

  async updateSettings(dto: Partial<Settings>): Promise<Settings | null> {
    await this.settingsRepo.update({ id: 1 }, dto);
    const settings = await this.settingsRepo.findOne({ where: { id: 1 } });
    if (settings && !settings.schedule) {
      settings.schedule = DEFAULT_SCHEDULE;
    }
    return settings;
  }
}
