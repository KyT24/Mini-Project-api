import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express, { NextFunction, Request, Response } from 'express';
import cors, { CorsOptions } from 'cors';
import { corsOptions } from './configs/cors.config';
import { errorMiddleware } from './middlewares/error.middleware';
import { AuthRouter } from './features/auths/auth.route';

const PORT: number = parseInt(process.env.PORT!);
const API_PREFIX: string = process.env.API_PREFIX!;
const app = express();

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());
app.use(errorMiddleware);
app.use(`${API_PREFIX}/auth`, AuthRouter);
app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
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
