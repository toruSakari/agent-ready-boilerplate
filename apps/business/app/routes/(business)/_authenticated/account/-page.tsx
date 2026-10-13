import { ServiceAccount } from "@dev-template/client/service-account";

// サービス未登録・資格喪失後も利用するため、本人確認groupの内側かつサービス資格groupの外側に置く。
export function AccountPage() {
  return <ServiceAccount />;
}
