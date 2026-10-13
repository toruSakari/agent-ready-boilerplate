import { createValue } from "#api/domain/shared/create-value.ts";
import { z } from "zod";
import { PERMISSION_CODES } from "#api/domain/access/policies/permission-catalog.ts";
import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";

const schema = z.enum(PERMISSION_CODES).brand<"Permission">();

export type Permission = z.output<typeof schema>;

export const PermissionValue = Object.freeze({
  create(value: unknown): Permission {
    return createValue((input) => schema.safeParse(input), value, "操作権限の値が不正です");
  },
  toCode(value: Permission): PermissionCode {
    return value;
  },
});
