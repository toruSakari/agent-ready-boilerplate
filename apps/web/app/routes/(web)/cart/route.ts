import { createFileRoute } from "@tanstack/react-router";
import { CartPage } from "#app/routes/(web)/cart/-page.tsx";

export const Route = createFileRoute("/(web)/cart/")({ component: CartPage });
