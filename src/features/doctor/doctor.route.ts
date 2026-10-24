import { Router } from 'express';
import { DoctorController } from './doctor.controller';

export const doctorRouter = Router();

doctorRouter.post('/', DoctorController.createDoctor);
doctorRouter.get('/', DoctorController.getDoctors);
doctorRouter.get('/:id', DoctorController.getDoctorById);
doctorRouter.patch('/:id', DoctorController.updateDoctor);
doctorRouter.delete('/:id', DoctorController.deleteDoctor);
