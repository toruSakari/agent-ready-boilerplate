import { z } from "zod";
import { t } from "#client/shared/i18n";

export type AccessField = {
  name: string;
  label: string;
  type?: "text" | "email";
  maxLength?: number;
  options?: { value: string; label: string }[];
  initial?: string;
};

function invalidValue(field: AccessField, value: string) {
  if (!value) {
    return true;
  }

  if (field.maxLength && value.length > field.maxLength) {
    return true;
  }

  if (field.type === "email" && !z.email().safeParse(value).success) {
    return true;
  }

  return !!field.options && !field.options.some((option) => option.value === value);
}

export function createActionFormSchema(fields: AccessField[]) {
  // 動的項目も項目別エラーを返し、selectの任意文字列の混入を拒否する。
  return z.record(z.string(), z.string()).superRefine((values, ctx) => {
    for (const field of fields) {
      if (!invalidValue(field, values[field.name]?.trim() ?? "")) {
        continue;
      }

      ctx.addIssue({
        code: "custom",
        path: [field.name],
        message:
          field.type === "email"
            ? t("有効なメールアドレスを入力してください")
            : t("{{label}}を正しく入力してください", { label: field.label }),
      });
    }
  });
}
