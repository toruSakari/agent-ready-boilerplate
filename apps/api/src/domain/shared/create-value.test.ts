import { expect, it } from "vite-plus/test";
import { z } from "zod";
import { createValue } from "#api/domain/shared/create-value.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";

const schema = z.string().trim().min(1).brand<"Example">();

it("スキーマの変換後のブランド付き値を返す", () => {
  const value: z.output<typeof schema> = createValue(
    (input) => schema.safeParse(input),
    " example ",
    "値が不正です",
  );
  expect(value).toBe("example");
});

it("検証失敗を指定された文言のドメインエラーへ変換する", () => {
  const create = () => createValue((input) => schema.safeParse(input), " ", "値が不正です");
  expect(create).toThrow(InvalidValueObjectError);
  expect(create).toThrow("値が不正です");
});
