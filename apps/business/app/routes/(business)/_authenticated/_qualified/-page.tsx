import { OrganizationPicker } from "@dev-template/client/access";

// サービス資格を確認した後の企業選択入口。共有widgetを使い、所属を別サービスから流用しない。
export function HomePage() {
  return <OrganizationPicker />;
}
