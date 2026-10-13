import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { z } from "zod";
import { createValue } from "#api/domain/shared/create-value.ts";

export const accessIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(ACCESS_LIMITS.idMaxLength)
  .brand<"AccessId">();

export type AccessId = z.output<typeof accessIdSchema>;

export const AccessId = Object.freeze({
  create: (value: unknown): AccessId =>
    createValue((input) => accessIdSchema.safeParse(input), value, "識別子の形式が不正です"),
});
