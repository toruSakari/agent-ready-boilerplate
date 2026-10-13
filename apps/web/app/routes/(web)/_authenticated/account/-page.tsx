import { CustomerAccount } from "#web/widgets/customer-account/index.ts";

// 未登録・プラン未設定でも本人の登録・プラン変更・退会へ進める。
export function AccountPage() {
  return <CustomerAccount />;
}
