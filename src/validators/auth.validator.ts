import * as z from 'zod';

const email = z.email().trim().min(1, 'Email is required field');

const password = z
  .string()
  .min(1, 'Password is required field')
  .max(25, 'Password have maximum 25 characters');

const role = z.enum(['ADMIN', 'STAFF', 'DOCTOR', 'PATIENT']);

export const userRegisterSchema = z.object({
  body: z.object({
    email,
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