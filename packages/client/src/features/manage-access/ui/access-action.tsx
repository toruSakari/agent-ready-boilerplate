"use client";
import { t as translate, errorMessage } from "#client/shared/i18n";
import { useState } from "react";
import { Button } from "@dev-template/ui/button";
import { Alert, AlertDescription } from "@dev-template/ui/alert";

/** 単一操作の確認・処理中・失敗表示をまとめる。呼び出し元のPromiseには必要な更新完了も含める。 */
export function AccessAction(props: {
  label: string;
  confirmation?: string;
  onAction: () => Promise<unknown>;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div>
      <Button
        variant={props.confirmation ? "destructive" : "outline"}
        disabled={pending}
        onClick={async () => {
          // キャンセルでは操作を呼ばず、処理中にする前の状態を維持する。
          if (props.confirmation && !window.confirm(props.confirmation)) {
            return;
          }

          setPending(true);
          setError("");
          try {
            await props.onAction();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? translate("処理中…") : props.label}
      </Button>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
