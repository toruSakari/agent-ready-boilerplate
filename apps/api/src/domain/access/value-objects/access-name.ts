import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { z } from "zod";
import { createValue } from "#api/domain/shared/create-value.ts";

const nameSchema = z.string().trim().min(1).max(ACCESS_LIMITS.nameMaxLength).brand<"AccessName">();

export type AccessName = z.output<typeof nameSchema>;

export const AccessName = Object.freeze({
  create: (value: unknown): AccessName =>
    createValue((input) => nameSchema.safeParse(input), value, "名前の形式が不正です"),
});
