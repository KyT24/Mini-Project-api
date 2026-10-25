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
import { patientRouter } from './features/patient/patient.route';
import { scheduleRouter } from './features/schedule/schedule.route';
import { AppError } from './errors/app.error';

const PORT: number = parseInt(process.env.PORT!);
const API_PREFIX: string = process.env.API_PREFIX!;
const app = express();

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(errorMiddleware);
app.use(`${API_PREFIX}/auth`, AuthRouter);
app.use(`${API_PREFIX}/doctors`, doctorRouter);
app.use(`${API_PREFIX}/specialists`, specialistRouter);
app.use(`${API_PREFIX}/appointments`, appointmentRouter);
app.use(`${API_PREFIX}/patients`, patientRouter);
app.use(`${API_PREFIX}/schedules`, scheduleRouter);
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
  if (error instanceof AppError)
    return res.status(error.status).json({
      success: false,
      message: error.message,
      data: {},
    });
  if (error instanceof Error)
    return res.status(500).json({
      success: false,
      message: error?.message,
      data: {},
    });
});

/* Centralized Error */

if (process.env.NODE_ENV === 'DEVELOPMENT') {
  app.listen(PORT, () => {
    console.log(`Application Running on PORT: ${PORT}`);
  });
}

export default app;
