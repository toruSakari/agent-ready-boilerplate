import { createFileRoute } from "@tanstack/react-router";
import { InvitationPage } from "#app/routes/(business)/invitations/accept/-page.tsx";

export const Route = createFileRoute("/(business)/invitations/accept/")({
  component: InvitationPage,
});
