"use client";
import { t as translate } from "#client/shared/i18n";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "#client/shared/api/trpc";
import { AccessAction } from "#client/features/manage-access";
import { SERVICE_CATEGORY_LABELS } from "#client/entities/access";
import type { ServiceCategory, ServiceRegistration } from "#client/entities/access";

/** 指定したサービス会員だけの退会操作。成功後の画面遷移・表示はonWithdrawnに委ねる。 */
export function WithdrawServiceAccount(props: {
  category: ServiceCategory;
  onWithdrawn: () => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const withdrawal = useMutation(trpc.access.withdraw.mutationOptions());
  const label = SERVICE_CATEGORY_LABELS[props.category];
  return (
    <AccessAction
      label={
        props.category === "customer"
          ? translate("通販会員を退会する")
          : translate("{{service}}サービスを退会する", { service: label })
      }
      confirmation={
        props.category === "customer"
          ? translate(
              "通販会員を退会しますか？ログインアカウントと他のサービスの登録は残ります。過去の注文履歴は保持されます。",
            )
          : translate(
              "{{service}}サービスを退会しますか？このサービスの登録情報とすべての所属が解除されます。他のサービスの登録とClerkのログインアカウントは残ります。過去の注文・監査履歴は保持されます。",
              { service: label },
            )
      }
      onAction={async () => {
        await withdrawal.mutateAsync({ service: props.category });
        // このQueryClientは現在の本人・サービス・企業に限定される。
        // 遅れた応答が退会済みデータを戻さないよう取得を先に取り消し、そのスコープだけを消す。
        await queryClient.cancelQueries();
        queryClient.clear();
        // 退会成功を直ちに登録確認へ反映し、古い登録状態の再表示を避ける。
        queryClient.setQueryData(trpc.access.registration.queryKey({ service: props.category }), {
          registered: false,
          category: props.category,
          accountId: null,
        } satisfies ServiceRegistration);
        props.onWithdrawn();
      }}
    />
  );
}
