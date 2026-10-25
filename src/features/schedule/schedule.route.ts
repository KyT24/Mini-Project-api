import { Router } from 'express';
import { verifyRole, verifyToken } from '../../middlewares/auth.middleware';
import { ScheduleController } from './schedule.controller';

export const scheduleRouter = Router();

// GET publik (dipakai profil dokter), ubah data hanya untuk ADMIN
const adminOnly = [verifyToken, verifyRole('ADMIN')];

scheduleRouter.get('/', ScheduleController.getSchedules);
scheduleRouter.post('/', ...adminOnly, ScheduleController.createSchedule);
scheduleRouter.patch('/:id', ...adminOnly, ScheduleController.updateSchedule);
scheduleRouter.delete('/:id', ...adminOnly, ScheduleController.deleteSchedule);
