import { Router } from 'express';
import { verifyRole, verifyToken } from '../../middlewares/auth.middleware';
import { uploadSingleImage } from '../../middlewares/upload.middleware';
import { AppointmentController } from './appointment.controller';

export const appointmentRouter = Router();

// Kuota jadwal publik; reservasi & pembayaran hanya untuk PATIENT
const patientOnly = [verifyToken, verifyRole('PATIENT')];

appointmentRouter.get('/availability', AppointmentController.getAvailability);
appointmentRouter.post('/', ...patientOnly, AppointmentController.createAppointment);
// /me harus didaftarkan sebelum /:id agar tidak dianggap sebagai id
appointmentRouter.get('/me', ...patientOnly, AppointmentController.getMyAppointments);
appointmentRouter.get('/:id', ...patientOnly, AppointmentController.getMyAppointmentById);
appointmentRouter.patch('/:id/cancel', ...patientOnly, AppointmentController.cancelAppointment);
appointmentRouter.post('/:id/rating', ...patientOnly, AppointmentController.rateAppointment);
appointmentRouter.post(
  '/:id/payment-proof',
  ...patientOnly,
  uploadSingleImage('image'),
  AppointmentController.uploadPaymentProof,
);
