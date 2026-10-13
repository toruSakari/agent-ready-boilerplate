import { Outlet, useRouter } from "@tanstack/react-router";
import { BusinessProviders } from "#business/_app/providers/app-providers.tsx";

export function RootLayout() {
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <BusinessProviders nonce={nonce}>
      <Outlet />
    </BusinessProviders>
  );
}
