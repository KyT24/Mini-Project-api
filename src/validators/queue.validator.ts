import * as z from 'zod';
import { uuidValidator } from './validators.config';

export const checkInSchema = z.object({
  body: z.object({
    qr_token: z
      .string('QR Token is required')
      .trim()
      .min(1, 'QR Token cannot be empty'),
  }),
});

export type checkInRequest = z.infer<typeof checkInSchema>;

export const callNextSchema = z.object({
  body: z.object({
    session_id: uuidValidator('Session ID must be a valid UUID'),
  }),
});

export type callNextRequest = z.infer<typeof callNextSchema>;

export const noShowSchema = z.object({
  params: z.object({
    id: uuidValidator('Appointment ID must be a valid UUID'),
  }),
});

export type noShowRequest = z.infer<typeof noShowSchema>;

