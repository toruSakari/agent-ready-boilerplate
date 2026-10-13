import { signInPathParams } from "@dev-template/client/route-params";
import { createFileRoute } from "@tanstack/react-router";
import { SignInPage } from "#app/routes/(business)/sign-in/-page.tsx";

export const Route = createFileRoute("/(business)/sign-in/$/")({
  params: signInPathParams,
  component: SignInPage,
});
