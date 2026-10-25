import * as z from 'zod';

const doctor_id = z.uuid('Doctor id must be a valid uuid');

// Tanggal kalender "YYYY-MM-DD" (zona waktu klinik)
const session_date = z.iso.date('Session date must be in YYYY-MM-DD format');

// Jam mulai jadwal "HH:mm"; dicocokkan dengan jadwal dokter di service
const start_time = z
  .string('Schedule is required')
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Schedule is not available');

export const getAvailabilitySchema = z.object({
  query: z.object({ doctor_id, date: session_date }),
});

export type getAvailabilityRequest = z.infer<typeof getAvailabilitySchema>;

export const createAppointmentSchema = z.object({
  body: z.object({
    treatment_slug: z
      .string('Treatment is required')
      .trim()
      .min(1, 'Treatment is required')
      .max(150),
    doctor_id,
    session_date,
    start_time,
  }),
});

export type createAppointmentRequest = z.infer<typeof createAppointmentSchema>;

export const getMyAppointmentsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export type getMyAppointmentsRequest = z.infer<typeof getMyAppointmentsSchema>;

export const appointmentIdSchema = z.object({
  params: z.object({ id: z.uuid('Appointment id must be a valid uuid') }),
});

export type appointmentIdRequest = z.infer<typeof appointmentIdSchema>;

const id = z.uuid('Appointment id must be a valid uuid');

export const TRANSACTION_STATUSES = [
  'waiting_payment',
  'waiting_confirmation',
  'done',
  'rejected',
  'expired',
  'canceled',
] as const;

export const getAdminAppointmentsSchema = z.object({
  query: z.object({
    status: z.enum(TRANSACTION_STATUSES, 'Status is not valid').optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(10),
  }),
});

export type getAdminAppointmentsRequest = z.infer<typeof getAdminAppointmentsSchema>;

export const rejectAppointmentSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    reason: z
      .string('Reason is required')
      .trim()
      .min(1, 'Reason is required')
      .max(500, 'Reason have maximum 500 characters'),
  }),
});

export type rejectAppointmentRequest = z.infer<typeof rejectAppointmentSchema>;

// "" dari form dianggap null supaya review bisa dikosongkan
const review = z
  .preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().max(500, 'Review have maximum 500 characters').nullable(),
  )
  .optional();

export const rateAppointmentSchema = z.object({
  params: z.object({ id }),
  body: z.object({
    rating: z.coerce
      .number('Rating is required')
      .int('Rating must be 1 to 5')
      .min(1, 'Rating must be 1 to 5')
      .max(5, 'Rating must be 1 to 5'),
    review,
  }),
});

export type rateAppointmentRequest = z.infer<typeof rateAppointmentSchema>;
