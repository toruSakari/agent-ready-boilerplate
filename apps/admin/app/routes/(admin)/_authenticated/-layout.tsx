import { Outlet } from "@tanstack/react-router";
import { AuthenticationGate } from "@dev-template/client/guards";

export function AuthenticatedLayout() {
  // 本人確認だけを要求する入口。サービス会員の要否は内側のlayoutが決め、ログイン画面はgroup外に置く。
  return (
    <AuthenticationGate>
      <Outlet />
    </AuthenticationGate>
  );
}
