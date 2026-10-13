import { createFileRoute } from "@tanstack/react-router";
import { SignInPage } from "#app/routes/(web)/sign-in/-page.tsx";

export const Route = createFileRoute("/(web)/sign-in/")({ component: SignInPage });
