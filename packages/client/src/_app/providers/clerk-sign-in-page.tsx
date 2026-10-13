"use client";
import { t as translate } from "#client/shared/i18n";
import { Redirect } from "#client/_app/navigation/redirect";
import { useAuth, SignIn } from "@clerk/react";
import { INVITATION_PATH, useInvitation } from "#client/features/manage-access";
import { SIGN_IN_PATH, readSignInReturnPath } from "#client/shared/config/auth-routes";

export function ClerkSignInPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const { invitation } = useInvitation();
  // 招待の秘密はInvitationProviderが回収済み。ログイン画面へは秘密を含まない戻り先だけを渡す。
  const returnTo = readSignInReturnPath(window, invitation ? INVITATION_PATH : "/");
  if (!isLoaded) {
    return <p>{translate("認証情報を確認しています…")}</p>;
  }

  if (isSignedIn) {
    return <Redirect to={returnTo} />;
  }

  return (
    <main className="mx-auto grid max-w-md gap-4 p-6 text-foreground">
      <h1 className="text-2xl font-bold">{translate("ログイン")}</h1>
      <p>
        {translate(
          "ログインでは本人確認のみを行います。サービスへの登録は、ログイン後に別途行ってください。",
        )}
      </p>
      <SignIn
        routing="path"
        path={SIGN_IN_PATH}
        forceRedirectUrl={returnTo}
        signUpForceRedirectUrl={returnTo}
      />
    </main>
  );
}
