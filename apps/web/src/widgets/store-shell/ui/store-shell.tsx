import { StoreHeader } from "#web/widgets/store-shell/ui/store-header.tsx";
import { StoreFooter } from "#web/widgets/store-shell/ui/store-footer.tsx";
import type { ReactNode } from "react";

export function StoreShell(props: { children: ReactNode }) {
  return (
    <div className="storefront min-h-screen bg-background text-foreground">
      <StoreHeader />
      <main className="mx-auto min-h-[70vh] max-w-7xl px-5 py-8 md:py-10">{props.children}</main>
      <StoreFooter />
    </div>
  );
}
