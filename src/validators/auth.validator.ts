import { role } from '../generated/prisma/enums';
import * as z from 'zod';

const fullName = z
  .string()
  .min(1, 'Full name is required field')
  .max(100, 'Full name have maximum 100 characters');

const email = z.email().trim().min(1, 'Email is required field');

const password = z
  .string()
  .min(1, 'Password is required field')
  .max(25, 'Password have maximum 25 characters');

const phone_number = z
  .string()
  .min(1, 'Phone number is required field')
  .max(15, 'Phone number have maximum 15 characters');

export const userRegisterSchema = z.object({
  body: z.object({
    email,
    password,
    fullName,
    phone_number,
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
