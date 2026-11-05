import * as z from 'zod';

export const uuidValidator = (message = 'Must be a valid UUID') =>
  z
    .string(message)
    .regex(
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
      message,
    );

