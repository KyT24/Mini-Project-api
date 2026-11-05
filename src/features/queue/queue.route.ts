import { Router } from 'express';
import { verifyRole, verifyToken } from '../../middlewares/auth.middleware';
import { QueueController } from './queue.controller';

export const queueRouter = Router();
export const adminQueueRouter = Router();

// Endpoint publik: Display TV ruang tunggu (/queue)
queueRouter.get('/live', QueueController.getLiveQueue);

// Endpoint operasional admin / staf resepsionis
const staffOnly = [verifyToken, verifyRole('ADMIN', 'STAFF')];

adminQueueRouter.post('/check-in', ...staffOnly, QueueController.checkIn);
adminQueueRouter.patch('/call-next', ...staffOnly, QueueController.callNext);
adminQueueRouter.patch('/no-show/:id', ...staffOnly, QueueController.markNoShow);

