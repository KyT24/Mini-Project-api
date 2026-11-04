import { Request, Response } from 'express';
import { validate } from '../../validators/validate';
import {
  callNextSchema,
  checkInSchema,
  noShowSchema,
} from '../../validators/queue.validator';
import { QueueService } from './queue.service';

export class QueueController {
  // Check-In on-site via QR code
  static async checkIn(req: Request, res: Response) {
    const { body } = validate(checkInSchema, { body: req.body });

    const result = await QueueService.checkIn(body.qr_token);

    res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  }

  // Live Queue publik untuk TV (/queue)
  static async getLiveQueue(req: Request, res: Response) {
    const liveQueue = await QueueService.getLiveQueue();

    res.status(200).json({
      success: true,
      message: 'Antrean langsung berhasil dimuat',
      data: liveQueue,
    });
  }

  // Panggil nomor antrean berikutnya (Admin)
  static async callNext(req: Request, res: Response) {
    const { body } = validate(callNextSchema, { body: req.body });

    const result = await QueueService.callNext(body.session_id);

    res.status(200).json({
      success: true,
      message: 'Nomor antrean berhasil dipanggil',
      data: result,
    });
  }

  // Tandai No-Show (Admin)
  static async markNoShow(req: Request, res: Response) {
    const { params } = validate(noShowSchema, { params: req.params });

    const result = await QueueService.markNoShow(params.id);

    res.status(200).json({
      success: true,
      message: 'Pasien berhasil ditandai tidak hadir',
      data: result,
    });
  }
}

