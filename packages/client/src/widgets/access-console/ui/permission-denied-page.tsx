"use client";
import { t as translate } from "#client/shared/i18n";
import type { ReactNode } from "react";
import { Alert, AlertDescription } from "@dev-template/ui/alert";
import { ConsoleLayout } from "#client/widgets/access-console/ui/console-layout";

export function PermissionDeniedPage(props: { navigation?: ReactNode }) {
  return (
    <ConsoleLayout title={translate("利用権限")} navigation={props.navigation}>
      <Alert variant="destructive">
        <AlertDescription>
          {translate("このページを閲覧する権限がありません。利用できるページを選択してください。")}
        </AlertDescription>
      </Alert>
    </ConsoleLayout>
  );
}
