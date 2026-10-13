import { createValue } from "#api/domain/shared/create-value.ts";
import type { z } from "zod";
import { serviceAccountIdSchema } from "#api/domain/access/value-objects/service-account-id-schema.ts";

const customerAccountIdSchema = serviceAccountIdSchema("customer:").brand<"CustomerAccountId">();

export type CustomerAccountId = z.output<typeof customerAccountIdSchema>;

export const CustomerAccountId = Object.freeze({
  create(value: unknown): CustomerAccountId {
    return createValue(
      (input) => customerAccountIdSchema.safeParse(input),
      value,
      "通常会員IDの形式が不正です",
    );
  },
});
