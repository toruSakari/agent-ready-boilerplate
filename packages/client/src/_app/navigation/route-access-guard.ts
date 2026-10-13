import { organizationPathParamsSchema } from "#client/shared/config/route-params";
import { redirect } from "@tanstack/react-router";
import { signInUrl } from "#client/shared/config/auth-routes";
import type { RouteAccessInput, RouteAccessState } from "#client/_app/navigation/load-route-access";

import { ROUTE_ACCESS_ERRORS } from "#client/shared/config/access-errors";
export { ROUTE_ACCESS_ERRORS } from "#client/shared/config/access-errors";

type GuardOptions = {
  location: { pathname: string; searchStr: string };
  params: object;
};

type AccessReader = (input: RouteAccessInput) => Promise<RouteAccessState>;

function requireAccess(state: RouteAccessState, location: GuardOptions["location"]) {
  if (state === "signed-out") {
    throw redirect({ href: signInUrl(location.pathname + location.searchStr), replace: true });
  }

  if (state === "forbidden" || state === "unavailable") {
    throw new Error(ROUTE_ACCESS_ERRORS[state]);
  }
}

/** 公開URLを列挙せず、本人確認が必要なpathless routeだけへ接続する。 */
export function authenticatedBeforeLoad(read: AccessReader) {
  return async (props: GuardOptions): Promise<{ navigationRegistration: RouteAccessState }> => {
    // 子ルートのparams.parse失敗時も親のbeforeLoadは走るため、照会前に拒否する。
    if ("organizationId" in props.params) {
      organizationPathParamsSchema.parse(props.params);
    }

    const state = await read({ qualified: false });
    requireAccess(state, props.location);
    return { navigationRegistration: state };
  };
}

/** 遷移前の旧Providerではなく、Routerが復号した遷移先の企業IDを照会へ渡す。 */
export function qualifiedBeforeLoad(read: AccessReader, unregisteredTo: "/account" | "/register") {
  return async (
    props: GuardOptions & { context: { navigationRegistration?: RouteAccessState } },
  ): Promise<void> => {
    if (props.context.navigationRegistration === "unregistered") {
      throw redirect({ href: unregisteredTo, replace: true });
    }

    const organizationId =
      "organizationId" in props.params
        ? organizationPathParamsSchema.parse(props.params).organizationId
        : undefined;
    const state = await read({ qualified: true, organizationId });
    requireAccess(state, props.location);
    if (state === "unregistered") {
      throw redirect({ href: unregisteredTo, replace: true });
    }
  };
}
