import { Request, Response } from "express";
import { QueueService } from "./queues.service";

export class QueueController {
  static async checkIn(req: Request, res: Response) {
    const user = req.user as { id: string; role: string };
    const result = await QueueService.checkIn(req.body.qr_token, user.id);

    res.json({
      message: "Check-in success",
      appointment_code: result.appointment_code,
      queue_number: result.queue_number,
    });
  }

  static async callNext(req: Request, res: Response) {
    const result = await QueueService.callNext(req.params.sessionId as string);

    res.json({
      message: "Next patient called",
      current_number: result.current_number,
    });
  }

  static async noShow(req: Request, res: Response) {
    const user = req.user as { id: string; role: string };
    await QueueService.markNoShow(req.params.appointmentId as string, user.id);

    res.json({ message: "Appointment marked as no-show" });
  }

  static async live(req: Request, res: Response) {
    const result = await QueueService.liveQueue();
    res.json(result);
  }
}