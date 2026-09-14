import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  @Get('daily')
  async exportDaily(@Query('date') date: string, @Res() res: Response) {
    const buffer = await this.exportService.exportDaily(date);
    const [y, m, d] = date.split('-');
    const filename = `diemdanh_ngay_${d}-${m}-${y}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  }

  @Get('weekly')
  async exportWeekly(
    @Query('from') from: string,
    @Query('to') to: string,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.exportWeekly(from, to);
    const [fy, fm, fd] = from.split('-');
    const [ty, tm, td] = to.split('-');
    const filename = `diemdanh_tuan_${fd}-${fm}-${fy}_den_${td}-${tm}-${ty}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  }

  @Get('monthly')
  async exportMonthly(
    @Query('month') month: string,
    @Res() res: Response,
  ) {
    const buffer = await this.exportService.exportMonthly(month);
    const [y, m] = month.split('-');
    const filename = `diemdanh_thang_${m}-${y}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(buffer);
  }
}
