import { createFileRoute } from "@tanstack/react-router";
import { AccountPage } from "#app/routes/(web)/_authenticated/account/-page.tsx";

export const Route = createFileRoute("/(web)/_authenticated/account/")({ component: AccountPage });
