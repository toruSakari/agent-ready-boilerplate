import { Outlet, useRouter } from "@tanstack/react-router";
import { AppProviders } from "@dev-template/client/providers";

export function RootLayout() {
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <AppProviders service="operator" nonce={nonce}>
      <Outlet />
    </AppProviders>
  );
}
