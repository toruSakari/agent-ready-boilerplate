"use client";
import { t as translate } from "#client/shared/i18n";
import type { RouterInputs } from "@dev-template/api-types";
import { ROUTE_ACCESS_ERRORS } from "#client/_app/navigation/route-access-guard";
import { Button } from "@dev-template/ui/button";
import { DataSkeleton } from "#client/shared/ui/error-boundary";
import type { ReactNode } from "react";
import { MissingServiceRegistration } from "#client/entities/access";
import { useServiceQualification } from "#client/_app/guards/use-service-qualification";

/**
 * beforeLoadの確認後も、layoutが明示したサービスの資格変更・通信失敗を監視して表示を取り下げる。
 * 未登録時の独自導線もアプリから受け取り、共有側ではURLから適用方針を選ばない。
 */
export function ServiceQualificationGate(props: {
  children: ReactNode;
  service: RouterInputs["access"]["session"]["service"];
  missingRegistrationContent?: ReactNode;
}) {
  const { registration, error, checking, retry } = useServiceQualification(props.service);
  // 再確認中はフォームを維持し、失敗・会員不一致・鮮度切れでは表示を止める。
  if (!error && checking) {
    return (
      <main className="mx-auto max-w-md p-6 text-foreground">
        <DataSkeleton label={translate("利用資格を確認しています…")} />
        <Button variant="outline" onClick={() => void retry()}>
          {translate("もう一度確認")}
        </Button>
      </main>
    );
  }

  if (error) {
    throw new Error(
      error.data?.code === "FORBIDDEN"
        ? ROUTE_ACCESS_ERRORS.forbidden
        : ROUTE_ACCESS_ERRORS.unavailable,
    );
  }

  if (registration && !registration.registered) {
    return (
      <main className="mx-auto grid max-w-md gap-4 p-6 text-foreground">
        <MissingServiceRegistration category={registration.category}>
          {props.missingRegistrationContent}
        </MissingServiceRegistration>
        <Button variant="outline" onClick={() => void retry()}>
          {translate("登録状況を再確認")}
        </Button>
      </main>
    );
  }

  return props.children;
}
