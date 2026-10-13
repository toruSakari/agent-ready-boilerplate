import { LanguageMenu } from "@dev-template/client/language";
import { getLocale, getTextDirection } from "@dev-template/client/i18n";
import { HeadContent, Scripts, useRouter } from "@tanstack/react-router";
import type { ReactNode } from "react";
import "#app/globals.css";

export function RootDocument(props: { children: ReactNode }) {
  const nonce = useRouter().options.ssr?.nonce;
  return (
    <html lang={getLocale()} dir={getTextDirection()} suppressHydrationWarning>
      <head>
        <meta property="csp-nonce" nonce={nonce} />
        <HeadContent />
      </head>
      <body>
        {props.children}
        <div className="fixed bottom-4 right-4 z-50 rounded-md bg-background p-1 shadow-sm">
          <LanguageMenu />
        </div>
        <Scripts />
      </body>
    </html>
  );
}
