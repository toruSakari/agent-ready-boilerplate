import { createValue } from "#api/domain/shared/create-value.ts";
import type { z } from "zod";
import { serviceAccountIdSchema } from "#api/domain/access/value-objects/service-account-id-schema.ts";

const businessAccountIdSchema = serviceAccountIdSchema("business:").brand<"BusinessAccountId">();

export type BusinessAccountId = z.output<typeof businessAccountIdSchema>;

export const BusinessAccountId = Object.freeze({
  create(value: unknown): BusinessAccountId {
    return createValue(
      (input) => businessAccountIdSchema.safeParse(input),
      value,
      "企業担当者IDの形式が不正です",
    );
  },
});
