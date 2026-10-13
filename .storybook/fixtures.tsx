import { TestRouter } from "@dev-template/client/testing/router";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { shouldThrowQueryError } from "@dev-template/client/api";
import { useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCProvider } from "#client/shared/api/trpc";
import { ServiceContext, OrganizationScope } from "#client/shared/api/client-context";
import { AuthenticationContext } from "#client/shared/api/authentication-context";

import { createStoryClient } from "@/.storybook/story-client.ts";
import { STORY_SERVICES } from "@/.storybook/story-fixtures.ts";
import type { StoryFixtures } from "@/.storybook/story-fixtures.ts";
export { createStoryClient } from "@/.storybook/story-client.ts";
export type { StoryFixtures, StoryResult } from "@/.storybook/story-fixtures.ts";

export function StoryProviders(props: { fixtures?: StoryFixtures; children: ReactNode }) {
  const { fixtures = {}, children } = props;

  // Story単位のキャッシュを持つ。fixture変更時の作り直しはpreview側のkeyが担当する。
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            throwOnError: shouldThrowQueryError,
            retry: false,
            staleTime: Infinity,
            refetchOnWindowFocus: false,
          },
          mutations: { retry: false },
        },
      }),
  );
  const [trpcClient] = useState(() => createStoryClient(fixtures));
  return (
    <TestRouter>
      <AuthenticationContext.Provider value={fixtures.authentication ?? "signed-in"}>
        <ServiceContext.Provider value={STORY_SERVICES[fixtures.mode ?? "web"]}>
          <OrganizationScope id={fixtures.organizationId ?? "story-organization"}>
            <QueryClientProvider client={queryClient}>
              <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
                <DataErrorBoundary>{children}</DataErrorBoundary>
              </TRPCProvider>
            </QueryClientProvider>
          </OrganizationScope>
        </ServiceContext.Provider>
      </AuthenticationContext.Provider>
    </TestRouter>
  );
}

export {
  organizationId,
  session,
  roles,
  memberFixtures,
} from "@/.storybook/access-console-fixtures";
