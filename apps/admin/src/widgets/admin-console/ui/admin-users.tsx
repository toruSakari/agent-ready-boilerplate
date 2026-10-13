"use client";
import { DirectorySearch } from "#admin/widgets/admin-console/ui/directory-search.tsx";
import { AdminUserCard } from "#admin/widgets/admin-console/ui/admin-user-card.tsx";
import { matchesUserSearch } from "#admin/widgets/admin-console/model/user-search.ts";
import { t as translate } from "@dev-template/client/i18n";
import { useState } from "react";
import { usePermissions } from "@dev-template/client/entities/access";
import { useUsers } from "#admin/entities/directory/index.ts";
import { Card } from "@dev-template/ui/card";

export function AdminUsers() {
  const { can } = usePermissions("platform");
  const canReadPersonal = can("user.personal.read");
  const users = useUsers();
  const [search, setSearch] = useState("");
  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-3xl font-bold">{translate("ユーザー管理")}</h1>
        <p className="mt-2 text-muted-foreground">
          {translate("サービス登録と企業への所属を管理します。")}
        </p>
      </div>
      {users.data !== null && (
        <DirectorySearch
          id="directory-search"
          label={translate("企業・ユーザーを検索")}
          placeholder={translate("名前・メール・ロール")}
          value={search}
          onChange={setSearch}
        />
      )}
      {users.data !== null && (
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">{translate("ユーザー一覧")}</h2>

          {/* 個人情報の権限が失効したら、古いメールを表示だけでなく検索条件からも除く。 */}
          {users.data
            .filter((u) => matchesUserSearch(u, search, canReadPersonal))
            .map((u) => (
              <AdminUserCard key={u.id} user={u} />
            ))}
        </section>
      )}
      {users.data?.length === 0 && (
        <Card className="p-10 text-center text-muted-foreground">
          {translate("登録されたユーザーはありません。")}
        </Card>
      )}
      {users.data === null && (
        <Card className="p-10">{translate("ユーザー一覧を閲覧する権限がありません。")}</Card>
      )}
    </div>
  );
}
