import * as z from 'zod';

// "true"/"false" dari query string (z.coerce.boolean menganggap "false" = true)
const boolFromString = z.preprocess((value) => {
  if (value === 'true' || value === '1') return true;
  if (value === 'false' || value === '0') return false;
  return value;
}, z.boolean('is_active must be true or false'));

const id = z.uuid('Schedule id must be a valid uuid');

const doctor_id = z.uuid('Doctor id must be a valid uuid');

const day_of_week = z.coerce
  .number('Day must be a number')
  .int('Day must be an integer')
  .min(0, 'Day must be between 0 and 6')
  .max(6, 'Day must be between 0 and 6');

const time = z
  .string('Time is required')
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:mm format');

const patient_quota = z.coerce
  .number('Patient quota must be a number')
  .int('Patient quota must be an integer')
  .min(1, 'Patient quota must be at least 1')
  .max(100, 'Patient quota have maximum 100');

// "HH:mm" bisa dibandingkan sebagai string
const endAfterStart = (data: { start_time?: string; end_time?: string }) =>
  !data.start_time || !data.end_time || data.end_time > data.start_time;
const endAfterStartMessage = { message: 'End time must be after start time' };

export const getSchedulesSchema = z.object({
  query: z.object({ doctor_id, is_active: boolFromString.optional() }),
});

export type getSchedulesRequest = z.infer<typeof getSchedulesSchema>;

export const createScheduleSchema = z.object({
  body: z
    .object({
      doctor_id,
      day_of_week,
      start_time: time,
      end_time: time,
      patient_quota,
      is_active: boolFromString.default(true),
    })
    .refine(endAfterStart, endAfterStartMessage),
});

export type createScheduleRequest = z.infer<typeof createScheduleSchema>;

export const scheduleIdSchema = z.object({
  params: z.object({ id }),
});

export type scheduleIdRequest = z.infer<typeof scheduleIdSchema>;

// Dokter tidak bisa dipindah, minimal satu field dikirim
export const updateScheduleSchema = z.object({
  params: z.object({ id }),
  body: z
    .object({
      day_of_week: day_of_week.optional(),
      start_time: time.optional(),
      end_time: time.optional(),
      patient_quota: patient_quota.optional(),
      is_active: boolFromString.optional(),
    })
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'At least one field must be provided',
    })
    .refine(endAfterStart, endAfterStartMessage),
});

export type updateScheduleRequest = z.infer<typeof updateScheduleSchema>;
