import type { z } from "zod";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";

export function createValue<T>(
  parse: (value: unknown) => z.ZodSafeParseResult<T>,
  value: unknown,
  message: string,
): T {
  const result = parse(value);
  if (!result.success) {
    throw new InvalidValueObjectError(message);
  }

  return result.data;
}
