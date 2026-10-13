import { createFileRoute } from "@tanstack/react-router";
import { RegisterPage } from "#app/routes/(web)/register/-page.tsx";

export const Route = createFileRoute("/(web)/register/")({ component: RegisterPage });
