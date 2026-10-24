import * as z from 'zod';

// "" dari form dianggap null supaya kolom opsional bisa dikosongkan
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    schema,
  );

// "true"/"false" dari query string (z.coerce.boolean menganggap "false" = true)
const boolFromString = z.preprocess((v) => {
  if (v === 'true' || v === '1') return true;
  if (v === 'false' || v === '0') return false;
  return v;
}, z.boolean('is_active must be true or false'));

// Decimal(12,2): maks 10 digit sebelum koma, 2 digit sesudah koma
const consultation_fee = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .pipe(
    z
      .string()
      .regex(
        /^\d{1,10}(\.\d{1,2})?$/,
        'Consultation fee must be >= 0, max 10 digits with up to 2 decimals',
      ),
  );

const id = z.uuid('Doctor id must be a valid uuid');

const user_id = z.uuid('User id must be a valid uuid');

const full_name = z
  .string('Full name is required')
  .trim()
  .min(1, 'Full name is required')
  .max(150, 'Full name have maximum 150 characters');

const bio = emptyToNull(z.string().trim().nullable()).optional();

const experience_years = z.coerce
  .number('Experience years must be a number')
  .int('Experience years must be an integer')
  .min(0, 'Experience years cannot be negative')
  .max(2147483647, 'Experience years is too large');

const photo = emptyToNull(
  z.string().trim().max(255, 'Photo have maximum 255 characters').nullable(),
).optional();

export const createDoctorSchema = z.object({
  body: z.object({
    user_id,
    full_name,
    bio,
    experience_years: experience_years.default(0),
    consultation_fee: consultation_fee.default('0'),
    photo,
    is_active: boolFromString.default(true),
  }),
});

export type createDoctorRequest = z.infer<typeof createDoctorSchema>;

export const getDoctorsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(150).optional(),
    is_active: boolFromString.optional(),
    sort: z
      .enum(['newest', 'fee_asc', 'fee_desc', 'experience_desc'])
      .default('newest'),
  }),
});

export type getDoctorsRequest = z.infer<typeof getDoctorsSchema>;

export const doctorIdSchema = z.object({
  params: z.object({ id }),
});

export type doctorIdRequest = z.infer<typeof doctorIdSchema>;

// user_id tidak boleh diganti, minimal satu field dikirim
export const updateDoctorSchema = z.object({
  params: z.object({ id }),
  body: z
    .object({
      full_name: full_name.optional(),
      bio,
      experience_years: experience_years.optional(),
      consultation_fee: consultation_fee.optional(),
      photo,
      is_active: boolFromString.optional(),
    })
    .strict()
    .refine((data) => Object.values(data).some((v) => v !== undefined), {
      message: 'At least one field must be provided',
    }),
});

export type updateDoctorRequest = z.infer<typeof updateDoctorSchema>;
