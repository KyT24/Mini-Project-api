import { Request, Response } from 'express';
import {
  createScheduleSchema,
  getSchedulesSchema,
  scheduleIdSchema,
  updateScheduleSchema,
} from '../../validators/schedule.validator';
import { validate } from '../../validators/validate';
import { ScheduleService } from './schedule.service';

export class ScheduleController {
  static async getSchedules(req: Request, res: Response) {
    const { query } = validate(getSchedulesSchema, { query: req.query });

    const schedules = await ScheduleService.getAll({ query });

    res.status(200).json({
      success: true,
      message: 'schedules retrieved successfully',
      data: schedules,
    });
  }

  static async createSchedule(req: Request, res: Response) {
    const { body } = validate(createScheduleSchema, { body: req.body });

    const schedule = await ScheduleService.create({ body });

    res.status(201).json({
      success: true,
      message: 'schedule created successfully',
      data: schedule,
    });
  }

  static async updateSchedule(req: Request, res: Response) {
    const { params, body } = validate(updateScheduleSchema, {
      params: req.params,
      body: req.body,
    });

    const schedule = await ScheduleService.update({ params, body });

    res.status(200).json({
      success: true,
      message: 'schedule updated successfully',
      data: schedule,
    });
  }

  static async deleteSchedule(req: Request, res: Response) {
    const { params } = validate(scheduleIdSchema, { params: req.params });

    await ScheduleService.delete({ params });

    res.status(200).json({
      success: true,
      message: 'schedule deleted successfully',
      data: {},
    });
  }
}
