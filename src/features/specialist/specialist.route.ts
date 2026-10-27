import { Router } from 'express';
import { verifyRole, verifyToken } from '../../middlewares/auth.middleware';
import { SpecialistController } from './specialist.controller';

export const specialistRouter = Router();

// GET publik (dipakai form dokter & halaman pasien), ubah data hanya untuk ADMIN
const adminOnly = [verifyToken, verifyRole('ADMIN')];

specialistRouter.post('/', ...adminOnly, SpecialistController.createSpecialist);
specialistRouter.get('/', SpecialistController.getSpecialists);
specialistRouter.get('/:id', SpecialistController.getSpecialistById);
specialistRouter.patch('/:id', ...adminOnly, SpecialistController.updateSpecialist);
specialistRouter.delete('/:id', ...adminOnly, SpecialistController.deleteSpecialist);
