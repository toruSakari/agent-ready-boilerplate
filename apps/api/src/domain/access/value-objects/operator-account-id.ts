import { createValue } from "#api/domain/shared/create-value.ts";
import type { z } from "zod";
import { serviceAccountIdSchema } from "#api/domain/access/value-objects/service-account-id-schema.ts";

const operatorAccountIdSchema = serviceAccountIdSchema("operator:").brand<"OperatorAccountId">();

export type OperatorAccountId = z.output<typeof operatorAccountIdSchema>;

export const OperatorAccountId = Object.freeze({
  create(value: unknown): OperatorAccountId {
    return createValue(
      (input) => operatorAccountIdSchema.safeParse(input),
      value,
      "運営アカウントIDの形式が不正です",
    );
  },
});
