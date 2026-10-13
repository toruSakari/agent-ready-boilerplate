import { t as translate } from "#client/shared/i18n";
import { SERVICE_CATEGORY_LABELS } from "#client/entities/access";
import type { ServiceCategory } from "#client/entities/access";
import { WithdrawServiceAccount } from "#client/features/manage-service-account";
import { Card } from "@dev-template/ui/card";

export function ServiceWithdrawal(props: { category: ServiceCategory; onWithdrawn: () => void }) {
  const label = SERVICE_CATEGORY_LABELS[props.category];
  return (
    <Card className="grid gap-4 p-5">
      <h2 className="text-xl font-semibold">
        {props.category === "customer"
          ? translate("通販会員の退会")
          : translate("{{service}}サービスを退会", { service: label })}
      </h2>
      <p>
        {props.category === "customer"
          ? translate(
              "通販会員の登録を削除します。ログインアカウントと他のサービスの登録は残ります。",
            )
          : translate(
              "{{service}}サービスの登録を削除し、このサービス内の所属をすべて解除します。他のサービスの登録とClerkのログインアカウントは削除されません。",
              { service: label },
            )}
      </p>
      <p>{translate("過去の注文・監査履歴は保持されます。")}</p>
      {props.category !== "customer" && (
        <p>{translate("最後のオーナーは退会できません。先に別のオーナーを設定してください。")}</p>
      )}
      <WithdrawServiceAccount category={props.category} onWithdrawn={props.onWithdrawn} />
    </Card>
  );
}
