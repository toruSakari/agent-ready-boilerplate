import { z } from "zod";
import { ApplicationError } from "#api/application/shared/application-error.ts";

/** 通信入力のDTO検証だけを400として扱う。UseCaseが生成する出力DTOの不正は内部障害として伝える。 */
export function parseInputDto<Output, Input>(
  schema: z.ZodType<Output, Input>,
  input: unknown,
): Output {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ApplicationError({
      code: "BAD_REQUEST",
      message: "入力内容が不正です。入力内容を確認してください",
    });
  }

  return result.data;
}
