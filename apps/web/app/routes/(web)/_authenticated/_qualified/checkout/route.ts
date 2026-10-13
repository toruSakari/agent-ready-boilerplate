import { createFileRoute } from "@tanstack/react-router";
import { CheckoutPage } from "#app/routes/(web)/_authenticated/_qualified/checkout/-page.tsx";

export const Route = createFileRoute("/(web)/_authenticated/_qualified/checkout/")({
  component: CheckoutPage,
});
