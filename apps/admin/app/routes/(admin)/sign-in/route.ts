import { createFileRoute } from "@tanstack/react-router";
import { SignInPage } from "#app/routes/(admin)/sign-in/-page.tsx";

export const Route = createFileRoute("/(admin)/sign-in/")({ component: SignInPage });
