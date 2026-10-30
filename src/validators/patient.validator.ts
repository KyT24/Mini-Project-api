import * as z from 'zod';

// "" dari form dianggap null supaya kolom opsional bisa dikosongkan
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => {
      if (typeof value === 'string' && value.trim() === '') return null;
      return value;
    },
    schema,
  );

const full_name = z
  .string('Full name is required')
  .trim()
  .min(1, 'Full name is required')
  .max(150, 'Full name have maximum 150 characters');

const email = z.email('Email is not valid').trim().max(255);

const phone_number = z
  .string()
  .trim()
  .min(1, 'Phone number is required field')
  .max(20, 'Phone number have maximum 20 characters');

// Format YYYY-MM-DD, tidak boleh di masa depan
const date_of_birth = emptyToNull(
  z.iso
    .date('Date of birth must be YYYY-MM-DD')
    .refine((date) => new Date(date) <= new Date(), {
      message: 'Date of birth cannot be in the future',
    })
    .nullable(),
).optional();

const gender = emptyToNull(
  z.enum(['male', 'female', 'other'], 'Gender is not valid').nullable(),
).optional();

const address = emptyToNull(z.string().trim().nullable()).optional();

// Minimal satu field dikirim
export const updatePatientMeSchema = z.object({
  body: z
    .object({
      full_name: full_name.optional(),
      email: email.optional(),
      phone_number: phone_number.optional(),
      date_of_birth,
      gender,
      address,
    })
    .strict()
    .refine((data) => Object.values(data).some((value) => value !== undefined), {
      message: 'At least one field must be provided',
    }),
});

export type updatePatientMeRequest = z.infer<typeof updatePatientMeSchema>;
