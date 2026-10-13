import { AdminShell } from "#admin/widgets/admin-console/index.ts";
import { Outlet } from "@tanstack/react-router";
import { ServiceQualificationGate } from "@dev-template/client/guards";

export function QualifiedLayout() {
  // /accountはこのgroupの外に置き、サービス資格を失っても登録状況の確認・退会へ進めるようにする。
  // 遷移前はbeforeLoadが確認し、ここは表示中の資格変更を監視する。取得・変更はAPIでも検証する。
  return (
    <ServiceQualificationGate service="operator">
      <AdminShell>
        <Outlet />
      </AdminShell>
    </ServiceQualificationGate>
  );
}
