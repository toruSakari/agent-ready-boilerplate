import { AcceptInvitation } from "@dev-template/client/access";

// 招待fragmentを先に取り込む公開入口。本人確認や対象サービスへの登録は共有の招待承諾フローで扱う。
export function InvitationPage() {
  return <AcceptInvitation />;
}
