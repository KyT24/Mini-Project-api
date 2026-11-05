import { CorsOptions } from "cors";

export const corsOptions: CorsOptions = {
  // Izinkan cookie/credential dari frontend (axios withCredentials: true)
  credentials: true,
  origin: function (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) {
    // 1. Izinkan request tanpa origin (seperti curl, Postman, mobile app, atau server-to-server fetch dari Next.js SSR)
    if (!origin) {
      return callback(null, true);
    }

    // 2. Di mode development, izinkan semua origin
    if (process.env.NODE_ENV !== 'PRODUCTION') {
      return callback(null, true);
    }

    const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((o) => o.trim().replace(/\/$/, ''))
      .filter(Boolean);

    const cleanOrigin = origin.replace(/\/$/, '');

    // 3. Izinkan domain yang terdaftar secara eksplisit atau wildcard *
    if (allowedOrigins.includes('*') || allowedOrigins.includes(cleanOrigin)) {
      return callback(null, true);
    }

    // 4. Izinkan otomatis seluruh domain deployment Vercel (*.vercel.app) dan localhost
    if (cleanOrigin.endsWith('.vercel.app') || cleanOrigin.includes('localhost') || cleanOrigin.includes('127.0.0.1')) {
      return callback(null, true);
    }

    // Menolak origin tanpa melempar runtime exception unhandled error
    return callback(null, false);
  },
};