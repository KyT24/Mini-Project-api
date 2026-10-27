import { Router } from 'express';
import { verifyRole, verifyToken } from '../../middlewares/auth.middleware';
import { AppointmentAdminController } from './appointment-admin.controller';

export const adminAppointmentRouter = Router();

// Verifikasi pembayaran khusus ADMIN
const adminOnly = [verifyToken, verifyRole('ADMIN')];

adminAppointmentRouter.get('/', ...adminOnly, AppointmentAdminController.getAppointments);
adminAppointmentRouter.get('/:id', ...adminOnly, AppointmentAdminController.getAppointmentById);
adminAppointmentRouter.patch(
  '/:id/approve',
  ...adminOnly,
  AppointmentAdminController.approveAppointment,
);
adminAppointmentRouter.patch(
  '/:id/reject',
  ...adminOnly,
  AppointmentAdminController.rejectAppointment,
);
