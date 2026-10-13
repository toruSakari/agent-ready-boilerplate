import { BusinessNavigation } from "#business/widgets/business-navigation/index.ts";
import { PermissionDeniedPage } from "@dev-template/client/access";
import { PermissionGate } from "@dev-template/client/entities/access";
import { BusinessMembers } from "#business/widgets/business-members/index.ts";

// 直リンクでも権限のない画面を描画しないための表示ガード。取得・更新の認可は共通APIでも検証する。
export function MembersPage() {
  // 拒否時にも利用可能な別画面へ移れるよう、business所有のナビゲーションをfallbackへ渡す。
  return (
    <PermissionGate
      required={["member.read"]}
      fallback={<PermissionDeniedPage navigation={<BusinessNavigation />} />}
    >
      <BusinessMembers navigation={<BusinessNavigation />} />
    </PermissionGate>
  );
}
