import { Outlet, useRouter } from "@tanstack/react-router";
import { WebProviders } from "#web/_app/providers/app-providers.tsx";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";

export function RootLayout() {
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <WebProviders nonce={nonce}>
      <DataErrorBoundary>
        <Outlet />
      </DataErrorBoundary>
    </WebProviders>
  );
}
