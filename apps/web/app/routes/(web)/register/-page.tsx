import { CustomerRegistration } from "#web/widgets/customer-registration/index.ts";

// 未登録の本人も到達する入口なので資格groupの外に置き、認証・登録状態はwidget内で案内する。
export function RegisterPage() {
  return <CustomerRegistration />;
}
