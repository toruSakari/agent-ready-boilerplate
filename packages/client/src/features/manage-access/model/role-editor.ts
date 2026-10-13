import { t as translate } from "#client/shared/i18n";
import { permissionLabel } from "#client/entities/access";
import { z } from "zod";
import { ACCESS_FORM_LIMITS } from "#client/features/manage-access/model/form-policy";

export const roleEditorSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { error: () => translate("ロール名を入力してください") })
    .max(ACCESS_FORM_LIMITS.nameMaxLength, {
      error: () =>
        translate("ロール名は{{max}}文字以下にしてください", {
          max: ACCESS_FORM_LIMITS.nameMaxLength,
        }),
    }),
  permissions: z.array(z.string()),
});

export type RoleEditorValues = z.infer<typeof roleEditorSchema>;

/** プラン外の既存・選択済み権限は削除できるよう残し、外した後の再追加は許可しない。 */
export function rolePermissionOptions(
  catalog: Record<string, string>,
  permissionLabels: Record<string, string>,
  initial: readonly string[],
  selected: readonly string[],
) {
  const visible = {
    ...catalog,
    ...Object.fromEntries(
      [...initial, ...selected]
        .filter((code) => !Object.hasOwn(catalog, code))
        .map((code) => [code, permissionLabels[code] ?? code]),
    ),
  };
  return Object.keys(visible).map((code) => ({
    code,
    label: permissionLabel(code),
    checked: selected.includes(code),
    disabled: !Object.hasOwn(catalog, code) && !selected.includes(code),
  }));
}
