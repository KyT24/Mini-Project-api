import { role } from '../generated/prisma/enums';
import * as z from 'zod';

const fullName = z
  .string()
  .min(1, 'Full name is required field')
  .max(100, 'Full name have maximum 100 characters');

const email = z.email().trim().min(1, 'Email is required field');

const full_name = z
  .string()
  .min(1, 'name is required field')
  .max(100, 'fullname have 100 maximum character');

const password = z
  .string()
  .min(1, 'Password is required field')
  .max(72, 'Password have maximum 72 characters');

const role = z.enum(['ADMIN', 'STAFF', 'DOCTOR', 'PATIENT']);

export const userRegisterSchema = z.object({
  body: z.object({
    full_name,
    email,
    phone_number,
    password,
    role,
  }),
});

export type userRegisterRequest = z.infer<typeof userRegisterSchema>;

export const userLoginSchema = z.object({
  body: z.object({
    email,
    password,
  }),
});

export type userLoginRequest = z.infer<typeof userLoginSchema>;
