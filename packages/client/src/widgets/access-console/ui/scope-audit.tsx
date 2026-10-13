"use client";
import { t as translate, formatDateTime } from "#client/shared/i18n";
import { useAudit } from "#client/entities/access";
import { Card } from "@dev-template/ui/card";

export function ScopeAudit(props: { scope: string }) {
  const audit = useAudit(props.scope);
  return (
    <section className="grid gap-4">
      {audit.data !== null && (
        <Card className="grid gap-2 p-5">
          <h3 className="font-semibold">{translate("監査ログ（最新100件）")}</h3>

          {audit.data.map((a) => (
            <p key={a.id} className="break-all text-sm">
              {translate("{{time}} / {{action}} / 操作者：{{actor}} / 対象：{{target}}", {
                time: formatDateTime(a.occurredAt),
                action: a.action,
                actor: a.actorId,
                target: a.targetId,
              })}
            </p>
          ))}
        </Card>
      )}
    </section>
  );
}
