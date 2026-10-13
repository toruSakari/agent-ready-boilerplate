import { getLocale, getTextDirection } from "@dev-template/client/i18n";
import { HeadContent, Scripts, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import "#app/globals.css";
import { StoreShell } from "#web/widgets/store-shell/index.ts";

export function RootDocument(props: { children: ReactNode }) {
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <html lang={getLocale()} dir={getTextDirection()} suppressHydrationWarning>
      <head>
        <meta property="csp-nonce" nonce={nonce} />
        <HeadContent />
      </head>
      <body>
        {/* 公開の買い物ナビはSSRする。認証SDKと招待秘密の回収は内側のProviderが担う。 */}
        <StoreShell>{props.children}</StoreShell>
        <Scripts />
      </body>
    </html>
  );
}
