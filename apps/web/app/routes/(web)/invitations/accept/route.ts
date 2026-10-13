import { createFileRoute } from "@tanstack/react-router";
import { InvitationPage } from "#app/routes/(web)/invitations/accept/-page.tsx";

export const Route = createFileRoute("/(web)/invitations/accept/")({ component: InvitationPage });
