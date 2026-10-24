import * as z from 'zod';

const email = z.email().trim().min(1, 'Email is required field');

const full_name = z
  .string()
  .min(1, 'name is required field')
  .max(100, 'fullname have 100 maximum character');

const password = z
  .string()
  .min(1, 'Password is required field')
  .max(72, 'Password have maximum 72 characters');

const phone_number = z
  .string()
  .trim()
  .min(1, 'Phone number is required field')
  .max(20, 'Phone number have maximum 20 characters');

export const userRegisterSchema = z.object({
  body: z.object({
    full_name,
    email,
    phone_number,
    password,
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
