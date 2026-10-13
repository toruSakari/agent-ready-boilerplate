import { createFileRoute } from "@tanstack/react-router";
import { InvitationPage } from "#app/routes/(admin)/invitations/accept/-page.tsx";

export const Route = createFileRoute("/(admin)/invitations/accept/")({ component: InvitationPage });
