import { t as translate } from "@dev-template/client/i18n";
import { SERVICE_CATEGORY_LABELS } from "@dev-template/client/entities/access";
import { AccessAction } from "@dev-template/client/manage-access";
import type { AccessUser } from "#admin/entities/directory/index.ts";
import { useDeleteUser } from "#admin/features/manage-users/api/use-delete-user.ts";

export function DeleteUserRegistration(props: { user: AccessUser }) {
  const deleteUser = useDeleteUser();
  return (
    <AccessAction
      label={translate("{{service}}サービスの登録を削除", {
        service: SERVICE_CATEGORY_LABELS[props.user.category],
      })}
      confirmation={translate(
        "{{name}}の{{service}}サービスの登録と所属を削除します。他のサービスの登録とClerkのログインアカウントは残ります。過去の注文・監査履歴は保持されます。実行しますか？",
        { name: props.user.name, service: SERVICE_CATEGORY_LABELS[props.user.category] },
      )}
      onAction={() => deleteUser.mutateAsync({ userId: props.user.id })}
    />
  );
}
