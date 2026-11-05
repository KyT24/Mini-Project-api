import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express, { NextFunction, Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import { corsOptions } from './configs/cors.config';
import { errorMiddleware } from './middlewares/error.middleware';
import { AuthRouter } from './features/auths/auth.route';
import { doctorRouter } from './features/doctor/doctor.route';
import { specialistRouter } from './features/specialist/specialist.route';
import { appointmentRouter } from './features/appointment/appointment.route';
import { adminAppointmentRouter } from './features/appointment/appointment-admin.route';
import { patientRouter } from './features/patient/patient.route';
import { scheduleRouter } from './features/schedule/schedule.route';
import { queueRouter, adminQueueRouter } from './features/queue/queue.route';
import { adminDashboardRouter } from './features/dashboard/dashboard.route';
import { AppError } from './errors/app.error';

const PORT: number = parseInt(process.env.PORT || '8000', 10);
const API_PREFIX: string = process.env.API_PREFIX || '/api/v1';
const app = express();

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(errorMiddleware);

// Health check endpoints
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'ARHE Clinic Appointment API is healthy and running',
    version: '1.0.0',
    prefix: API_PREFIX,
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(`${API_PREFIX}/auth`, AuthRouter);
app.use(`${API_PREFIX}/doctors`, doctorRouter);
app.use(`${API_PREFIX}/specialists`, specialistRouter);
app.use(`${API_PREFIX}/appointments`, appointmentRouter);
app.use(`${API_PREFIX}/admin/appointments`, adminAppointmentRouter);
app.use(`${API_PREFIX}/patients`, patientRouter);
app.use(`${API_PREFIX}/patient`, patientRouter);
app.use(`${API_PREFIX}/schedules`, scheduleRouter);
app.use(`${API_PREFIX}/queue`, queueRouter);
app.use(`${API_PREFIX}/admin/queue`, adminQueueRouter);
app.use(`${API_PREFIX}/admin/dashboard`, adminDashboardRouter);
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof AppError) {
    return res.status(error.status).json({
      success: false,
      message: error.message,
      data: {},
    });
  }
  if (error instanceof Error) {
    return res.status(500).json({
      success: false,
      message: error?.message,
      data: {},
    });
  }
});

/* Centralized Error */

// Hanya jalankan listener lokal jika di mode development dan BUKAN di runtime Vercel
if (process.env.NODE_ENV === 'DEVELOPMENT' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Application Running on PORT: ${PORT}`);
  });
}

export default app;
