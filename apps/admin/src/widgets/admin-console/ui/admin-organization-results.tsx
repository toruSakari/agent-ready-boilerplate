import { useState } from "react";
import { t } from "@dev-template/client/i18n";
import { Button } from "@dev-template/ui/button";
import { Card } from "@dev-template/ui/card";
import { useOrganizationDirectory } from "#admin/entities/directory/index.ts";
import { AdminOrganizationsTable } from "#admin/widgets/admin-console/ui/admin-organizations-table.tsx";

export function AdminOrganizationResults(props: {
  filters: { search?: string; status?: "active" | "inactive"; planCode?: string };
}) {
  const [afterId, setAfterId] = useState<string>();
  const query = useOrganizationDirectory(props.filters, afterId);
  if (query.data === null) {
    return <Card className="p-10">{t("企業一覧を閲覧する権限がありません。")}</Card>;
  }

  return (
    <>
      <AdminOrganizationsTable organizations={query.data.items} />
      <div className="flex flex-wrap justify-center gap-3" aria-label={t("企業一覧のページ切替")}>
        <Button variant="outline" disabled={!afterId} onClick={() => setAfterId(undefined)}>
          {t("最初のページへ")}
        </Button>
        <Button
          variant="outline"
          disabled={!query.data.nextId}
          onClick={() => setAfterId(query.data?.nextId ?? undefined)}
        >
          {t("次へ")}
        </Button>
      </div>
    </>
  );
}
