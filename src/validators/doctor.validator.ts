import { z } from "zod";

/* ---------- Helper ---------- */

// "" dari form dianggap null, supaya kolom opsional bisa dikosongkan
const emptyToNull = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), schema);

// BigInt dari string/number (params URL, JSON, form-data)
const bigIntId = (label: string) =>
  z.coerce
    .bigint({ message: `${label} harus berupa angka` })
    .positive({ message: `${label} tidak valid` });

// Decimal(12,2): maks 10 digit sebelum koma, 2 digit sesudah koma.
// Output berupa string supaya presisi aman saat dikirim ke Prisma.Decimal.
const decimal12_2 = z
  .union([z.number(), z.string()])
  .transform((v) => String(v).trim())
  .pipe(
    z
      .string()
      .regex(/^\d{1,10}(\.\d{1,2})?$/, {
        message: "Biaya konsultasi harus angka ≥ 0, maks 10 digit dengan 2 desimal",
      })
  );

// "true"/"false" dari query string (z.coerce.boolean menganggap "false" = true)
const boolFromString = z.preprocess((v) => {
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return v;
}, z.boolean({ message: "Nilai harus true atau false" }));

/* ---------- Field ---------- */

const doctorFields = {
  user_id: bigIntId("User ID"),

  name: z
    .string({ message: "Nama wajib diisi" })
    .trim()
    .min(3, { message: "Nama minimal 3 karakter" })
    .max(150, { message: "Nama maksimal 150 karakter" }),

  bio: emptyToNull(
    z.string().trim().max(2000, { message: "Bio maksimal 2000 karakter" }).nullable()
  ).optional(),

  experience_years: z.coerce
    .number({ message: "Pengalaman harus berupa angka" })
    .int({ message: "Pengalaman harus bilangan bulat" })
    .min(0, { message: "Pengalaman tidak boleh negatif" })
    .max(70, { message: "Pengalaman maksimal 70 tahun" }),

  consultation_fee: decimal12_2,

  photo: emptyToNull(
    z.string().trim().max(255, { message: "Path/URL foto maksimal 255 karakter" }).nullable()
  ).optional(),

  is_active: boolFromString,
};

/* ---------- Schema ---------- */

// POST /doctors
// id, created_at, updated_at diisi database; relasi tidak divalidasi di sini.
export const createDoctorSchema = z.object({
  user_id: doctorFields.user_id,
  name: doctorFields.name,
  bio: doctorFields.bio,
  experience_years: doctorFields.experience_years.default(0),
  consultation_fee: doctorFields.consultation_fee.default("0"),
  photo: doctorFields.photo,
  is_active: doctorFields.is_active.default(true),
});

// PATCH /doctors/:id
// Semua opsional, user_id tidak boleh diganti, minimal satu field dikirim.
export const updateDoctorSchema = z
  .object({
    name: doctorFields.name.optional(),
    bio: doctorFields.bio,
    experience_years: doctorFields.experience_years.optional(),
    consultation_fee: doctorFields.consultation_fee.optional(),
    photo: doctorFields.photo,
    is_active: doctorFields.is_active.optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "Minimal satu field harus diubah",
  });

// /doctors/:id
export const doctorIdParamSchema = z.object({
  id: bigIntId("ID dokter"),
});

// GET /doctors?page=1&limit=10&search=...&is_active=true&sort=fee_asc
export const doctorQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().max(150).optional(),
  is_active: boolFromString.optional(),
  min_fee: decimal12_2.optional(),
  max_fee: decimal12_2.optional(),
  sort: z
    .enum(["newest", "name_asc", "fee_asc", "fee_desc", "experience_desc"])
    .default("newest"),
});

/* ---------- Types ---------- */

export type CreateDoctorInput = z.infer<typeof createDoctorSchema>;
export type UpdateDoctorInput = z.infer<typeof updateDoctorSchema>;
export type DoctorIdParam = z.infer<typeof doctorIdParamSchema>;
export type DoctorQuery = z.infer<typeof doctorQuerySchema>;