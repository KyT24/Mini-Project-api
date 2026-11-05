import { Router } from 'express';
import { verifyRole, verifyToken } from '../../middlewares/auth.middleware';
import { DashboardController } from './dashboard.controller';

export const adminDashboardRouter = Router();

// Khusus Admin & Staf
const staffOnly = [verifyToken, verifyRole('ADMIN', 'STAFF')];

adminDashboardRouter.get('/metrics', ...staffOnly, DashboardController.getMetrics);
adminDashboardRouter.get('/stats', ...staffOnly, DashboardController.getStats);

