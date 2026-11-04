import * as z from 'zod';

export const getDashboardStatsSchema = z.object({
  query: z.object({
    period: z.enum(['day', 'month', 'year']).default('month'),
    from: z.iso.date('From date must be in YYYY-MM-DD format').optional(),
    to: z.iso.date('To date must be in YYYY-MM-DD format').optional(),
    doctor_id: z.uuid('Doctor ID must be a valid UUID').optional(),
  }),
});

export type getDashboardStatsRequest = z.infer<typeof getDashboardStatsSchema>;

