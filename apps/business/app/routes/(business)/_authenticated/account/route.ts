import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "#app/routes/(business)/_authenticated/account/-page.tsx";

export const Route = createFileRoute("/(business)/_authenticated/account/")({
  component: AccountPage,
});
