import { signInPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { SignInPage } from "#app/routes/(web)/sign-in/-page.tsx";

export const Route = createFileRoute("/(web)/sign-in/$/")({
  params: signInPathParams,
  component: SignInPage,
});
