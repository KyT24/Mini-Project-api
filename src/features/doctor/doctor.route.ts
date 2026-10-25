import { Router } from 'express';
import { verifyRole, verifyToken } from '../../middlewares/auth.middleware';
import { uploadSingleImage } from '../../middlewares/upload.middleware';
import { DoctorController } from './doctor.controller';

export const doctorRouter = Router();

// GET tetap publik (dipakai landing page), ubah data hanya untuk ADMIN
const adminOnly = [verifyToken, verifyRole('ADMIN')];

doctorRouter.post('/', ...adminOnly, DoctorController.createDoctor);
doctorRouter.post(
  '/photo',
  ...adminOnly,
  uploadSingleImage('photo'),
  DoctorController.uploadPhoto,
);
doctorRouter.get('/', DoctorController.getDoctors);
doctorRouter.get('/:id', DoctorController.getDoctorById);
doctorRouter.patch('/:id', ...adminOnly, DoctorController.updateDoctor);
doctorRouter.delete('/:id', ...adminOnly, DoctorController.deleteDoctor);
