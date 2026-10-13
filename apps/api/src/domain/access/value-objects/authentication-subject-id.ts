import { createValue } from "#api/domain/shared/create-value.ts";
import { z } from "zod";

// 外部プロバイダーのsubjectは不透明な識別子なので、会員IDの形式やtrimを適用しない。
const authenticationSubjectIdSchema = z
  .string()
  .refine((value) => value.trim().length > 0)
  .brand<"AuthenticationSubjectId">();

export type AuthenticationSubjectId = z.output<typeof authenticationSubjectIdSchema>;

export const AuthenticationSubjectId = Object.freeze({
  create(value: unknown): AuthenticationSubjectId {
    return createValue(
      (input) => authenticationSubjectIdSchema.safeParse(input),
      value,
      "認証主体IDは空白以外の文字を含めてください",
    );
  },
});
