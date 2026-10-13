import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { z } from "zod";
import { createValue } from "#api/domain/shared/create-value.ts";

const emailSchema = z
  .email()
  .max(ACCESS_LIMITS.emailMaxLength)
  .transform((value) => value.toLowerCase())
  .brand<"EmailAddress">();

export type EmailAddress = z.output<typeof emailSchema>;

export const EmailAddress = Object.freeze({
  create: (value: unknown): EmailAddress =>
    createValue((input) => emailSchema.safeParse(input), value, "メールアドレスの形式が不正です"),
});
