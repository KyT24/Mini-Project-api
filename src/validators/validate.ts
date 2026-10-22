import {AppError} from "../errors/app.error";
import {ZodType} from "zod";

export function validate<T>(schema: ZodType<T>, data: unknown): any {
  const result = schema.safeParse(data);
  
  if (!result.success) {
    const details = result.error.issues.map((issue) => (issue?.message));
    console.log(result.error.issues)
    throw new AppError(422, details?.join(', '));
    }

    return result?.data;
}