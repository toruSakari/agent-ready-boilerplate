"use client";
import { Redirect } from "#client/_app/navigation/redirect";
import { safeReturnPath } from "#client/shared/config/auth-routes";
import { ClerkSignInPage } from "#client/_app/providers/clerk-sign-in-page";

export function SignInPage() {
  return process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? (
    <ClerkSignInPage />
  ) : (
    <Redirect
      to={safeReturnPath(
        new URLSearchParams(window.location.search).get("returnTo"),
        window.location.origin,
      )}
    />
  );
}
