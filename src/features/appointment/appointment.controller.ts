import { Request, Response } from 'express';
import { TAuthPayload } from '../../middlewares/auth.middleware';
import {
  appointmentIdSchema,
  createAppointmentSchema,
  getAvailabilitySchema,
  getMyAppointmentsSchema,
  rateAppointmentSchema,
} from '../../validators/appointment.validator';
import { validate } from '../../validators/validate';
import { AppointmentService } from './appointment.service';

export class AppointmentController {
  static async getAvailability(req: Request, res: Response) {
    const { query } = validate(getAvailabilitySchema, { query: req.query });

    const availability = await AppointmentService.getAvailability({ query });

    res.status(200).json({
      success: true,
      message: 'availability retrieved successfully',
      data: availability,
    });
  }

  static async createAppointment(req: Request, res: Response) {
    const { body } = validate(createAppointmentSchema, { body: req.body });
    const auth = res.locals.auth as TAuthPayload;

    const appointment = await AppointmentService.createAndDescribe(auth.id, { body });

    res.status(201).json({
      success: true,
      message: 'appointment created successfully',
      data: appointment,
    });
  }

  static async getMyAppointments(req: Request, res: Response) {
    const { query } = validate(getMyAppointmentsSchema, { query: req.query });
    const auth = res.locals.auth as TAuthPayload;

    const { appointments, meta } = await AppointmentService.getOwnList(auth.id, { query });

    res.status(200).json({
      success: true,
      message: 'appointments retrieved successfully',
      data: appointments,
      meta,
    });
  }

  static async getMyAppointmentById(req: Request, res: Response) {
    const { params } = validate(appointmentIdSchema, { params: req.params });
    const auth = res.locals.auth as TAuthPayload;

    const appointment = await AppointmentService.getOwnById(auth.id, { params });

    res.status(200).json({
      success: true,
      message: 'appointment retrieved successfully',
      data: appointment,
    });
  }

  static async uploadPaymentProof(req: Request, res: Response) {
    const { params } = validate(appointmentIdSchema, { params: req.params });
    const auth = res.locals.auth as TAuthPayload;

    const appointment = await AppointmentService.uploadPaymentProof(
      auth.id,
      { params },
      req.file,
    );

    res.status(200).json({
      success: true,
      message: 'payment proof uploaded successfully',
      data: appointment,
    });
  }

  static async cancelAppointment(req: Request, res: Response) {
    const { params } = validate(appointmentIdSchema, { params: req.params });
    const auth = res.locals.auth as TAuthPayload;

    const appointment = await AppointmentService.cancel(auth.id, { params });

    res.status(200).json({
      success: true,
      message: 'appointment canceled successfully',
      data: appointment,
    });
  }

  static async rateAppointment(req: Request, res: Response) {
    const { params, body } = validate(rateAppointmentSchema, {
      params: req.params,
      body: req.body,
    });
    const auth = res.locals.auth as TAuthPayload;

    const appointment = await AppointmentService.rate(auth.id, { params, body });

    res.status(201).json({
      success: true,
      message: 'rating submitted successfully',
      data: appointment,
    });
  }
}
