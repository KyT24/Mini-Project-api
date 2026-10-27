import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.middleware';
import { PatientController } from './patient.controller';

export const patientRouter = Router();

patientRouter.get('/me', verifyToken, PatientController.getMe);
patientRouter.patch('/me', verifyToken, PatientController.updateMe);
