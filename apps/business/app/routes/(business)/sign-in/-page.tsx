import { SignInPage as SignInScreen } from "@dev-template/client/providers";

// 認証groupの外に置き、追加認証用のネストしたURLも同じログイン画面で受ける。
export function SignInPage() {
  return <SignInScreen />;
}
