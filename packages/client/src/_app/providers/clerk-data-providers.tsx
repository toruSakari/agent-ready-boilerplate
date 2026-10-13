"use client";
import type { Service } from "#client/shared/api/client-context";
import { useAuth } from "@clerk/react";
import type { ReactNode } from "react";
import { AuthenticationContext } from "#client/shared/api/authentication-context";
import type { AuthenticationStatus } from "#client/shared/api/authentication-context";
import { ScopedDataProviders } from "#client/_app/providers/scoped-data-providers";

export function ClerkDataProviders(props: {
  children: ReactNode;
  service: Service;
  organizationId: string;
}) {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth();
  // ClerkのuserId反映が遅れても、signed-out時点で旧本人のキャッシュから切り離す。
  let authentication: AuthenticationStatus;
  if (!isLoaded) {
    authentication = "loading";
  } else {
    if (isSignedIn) {
      authentication = "signed-in";
    } else {
      authentication = "signed-out";
    }
  }

  return (
    <AuthenticationContext.Provider value={authentication}>
      <ScopedDataProviders
        userId={isLoaded && isSignedIn && userId ? userId : "signed-out"}
        getToken={getToken}
        service={props.service}
        organizationId={props.organizationId}
      >
        {props.children}
      </ScopedDataProviders>
    </AuthenticationContext.Provider>
  );
}
