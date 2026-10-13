import { createFileRoute, redirect } from "@tanstack/react-router";
import { organizationPathParams } from "@dev-template/client/route-params";

export const Route = createFileRoute("/(web)/organizations/$organizationId/")({
  params: organizationPathParams,
  beforeLoad: (props) => {
    organizationPathParams.parse(props.params);
    throw redirect({ to: "/", replace: true });
  },
});
