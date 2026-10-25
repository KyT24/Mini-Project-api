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

const id = z.uuid('Specialist id must be a valid uuid');

const name = z
  .string('Name is required')
  .trim()
  .min(1, 'Name is required')
  .max(100, 'Name have maximum 100 characters');

const description = emptyToNull(z.string().trim().nullable()).optional();

export const createSpecialistSchema = z.object({
  body: z.object({
    name,
    description,
    is_active: boolFromString.default(true),
  }),
});

export type createSpecialistRequest = z.infer<typeof createSpecialistSchema>;

export const getSpecialistsSchema = z.object({
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(10),
    search: z.string().trim().max(100).optional(),
    is_active: boolFromString.optional(),
  }),
});

export type getSpecialistsRequest = z.infer<typeof getSpecialistsSchema>;

export const specialistIdSchema = z.object({
  params: z.object({ id }),
});

export type specialistIdRequest = z.infer<typeof specialistIdSchema>;

export const updateSpecialistSchema = z.object({
  params: z.object({ id }),
  body: z
    .object({
      name: name.optional(),
      description,
      is_active: boolFromString.optional(),
    })
    .strict()
    .refine((data) => Object.values(data).some((v) => v !== undefined), {
      message: 'At least one field must be provided',
    }),
});

export type updateSpecialistRequest = z.infer<typeof updateSpecialistSchema>;
