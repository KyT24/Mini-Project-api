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
