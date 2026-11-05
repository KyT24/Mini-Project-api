import { Request, Response } from 'express';
import { validate } from '../../validators/validate';
import { getDashboardStatsSchema } from '../../validators/dashboard.validator';
import { DashboardService } from './dashboard.service';

export class DashboardController {
  static async getMetrics(req: Request, res: Response) {
    const metrics = await DashboardService.getMetrics();

    res.status(200).json({
      success: true,
      message: 'Ringkasan metrik dashboard berhasil dimuat',
      data: metrics,
    });
  }

  static async getStats(req: Request, res: Response) {
    const { query } = validate(getDashboardStatsSchema, { query: req.query });

    const stats = await DashboardService.getStats({ query });

    res.status(200).json({
      success: true,
      message: 'Laporan statistik dashboard berhasil dimuat',
      data: stats,
    });
  }
}

