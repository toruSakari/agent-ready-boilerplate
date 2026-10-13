import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "#app/routes/(admin)/_authenticated/account/-page.tsx";

export const Route = createFileRoute("/(admin)/_authenticated/account/")({
  component: AccountPage,
});
