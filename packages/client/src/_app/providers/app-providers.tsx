"use client";
import type { Service } from "#client/shared/api/client-context";
import { DEFAULT_THEME, THEME_STORAGE_KEY } from "#client/features/switch-theme";
import { ThemeProvider } from "next-themes";
import { enUS, jaJP } from "@clerk/localizations";
import { getLocale } from "#client/shared/i18n";
import { ClerkProvider } from "@clerk/react";
import type { ReactNode } from "react";
import { InvitationProvider } from "#client/features/manage-access";
import { AuthenticationContext } from "#client/shared/api/authentication-context";
import { ScopedDataProviders } from "#client/_app/providers/scoped-data-providers";
import { ClerkDataProviders } from "#client/_app/providers/clerk-data-providers";

/**
 * 認証・通信・キャッシュ・テーマの共通機構を提供する。
 * serviceと選択企業の解決、公開／保護のroute groupは各アプリが所有する。
 * このProviderを置くだけではchildrenの利用資格を要求しない。
 */
export function AppProviders(props: {
  children: ReactNode;
  service: Service;
  organizationId?: string;
  nonce?: string;
}) {
  const { children, service, organizationId = "", nonce } = props;

  // 鍵なし分岐はローカルデモ用。実環境での設定必須条件はフロントエンド同期とAPIでも検証する。
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

  return (
    <ThemeProvider
      nonce={nonce}
      attribute="class"
      defaultTheme={DEFAULT_THEME}
      enableSystem
      storageKey={THEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      <InvitationProvider>
        {publishableKey ? (
          <ClerkProvider
            publishableKey={publishableKey}
            nonce={nonce}
            localization={getLocale() === "ja" ? jaJP : enUS}
          >
            <ClerkDataProviders service={service} organizationId={organizationId}>
              {children}
            </ClerkDataProviders>
          </ClerkProvider>
        ) : (
          <AuthenticationContext.Provider value="signed-in">
            <ScopedDataProviders
              userId="demo"
              getToken={async () => null}
              service={service}
              organizationId={organizationId}
            >
              {children}
            </ScopedDataProviders>
          </AuthenticationContext.Provider>
        )}
      </InvitationProvider>
    </ThemeProvider>
  );
}

export { OrganizationScope } from "#client/shared/api/client-context";
export { SignInPage } from "#client/_app/providers/sign-in-page";
