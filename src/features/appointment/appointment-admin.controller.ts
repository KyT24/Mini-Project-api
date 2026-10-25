import { Request, Response } from 'express';
import { TAuthPayload } from '../../middlewares/auth.middleware';
import {
  appointmentIdSchema,
  getAdminAppointmentsSchema,
  rejectAppointmentSchema,
} from '../../validators/appointment.validator';
import { validate } from '../../validators/validate';
import { AppointmentAdminService } from './appointment-admin.service';

export class AppointmentAdminController {
  static async getAppointments(req: Request, res: Response) {
    const { query } = validate(getAdminAppointmentsSchema, { query: req.query });

    const { appointments, meta } = await AppointmentAdminService.getAll({ query });

    res.status(200).json({
      success: true,
      message: 'appointments retrieved successfully',
      data: appointments,
      meta,
    });
  }

  static async getAppointmentById(req: Request, res: Response) {
    const { params } = validate(appointmentIdSchema, { params: req.params });

    const appointment = await AppointmentAdminService.getById({ params });

    res.status(200).json({
      success: true,
      message: 'appointment retrieved successfully',
      data: appointment,
    });
  }

  static async approveAppointment(req: Request, res: Response) {
    const { params } = validate(appointmentIdSchema, { params: req.params });
    const auth = res.locals.auth as TAuthPayload;

    const appointment = await AppointmentAdminService.approve(auth.id, { params });

    res.status(200).json({
      success: true,
      message: 'appointment approved successfully',
      data: appointment,
    });
  }

  static async rejectAppointment(req: Request, res: Response) {
    const { params, body } = validate(rejectAppointmentSchema, {
      params: req.params,
      body: req.body,
    });
    const auth = res.locals.auth as TAuthPayload;

    const appointment = await AppointmentAdminService.reject(auth.id, { params, body });

    res.status(200).json({
      success: true,
      message: 'appointment rejected successfully',
      data: appointment,
    });
  }
}
