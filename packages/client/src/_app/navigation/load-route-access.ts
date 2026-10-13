import type { AppRouter } from "@dev-template/api-types";
import { createTRPCClient, httpLink, TRPCClientError } from "@trpc/client";
import type { Service } from "#client/shared/api/client-context";

export type RouteAccessState =
  | "registered"
  | "unregistered"
  | "signed-out"
  | "forbidden"
  | "unavailable";

export type RouteAccessInput = { qualified: boolean; organizationId?: string };

/** 既存APIへ照会するだけの接続。会員・所属・IP・運営Accessの判定はAPIに委ねる。 */
export async function loadRouteAccess(props: {
  request: Request;
  service: Service;
  input: RouteAccessInput;
  sessionToken?: string;
  fetch: typeof fetch;
}): Promise<RouteAccessState> {
  const headers = new Headers(props.request.headers);
  headers.delete("x-organization-id");
  if (props.input.organizationId) {
    headers.set("x-organization-id", props.input.organizationId);
  }

  // documentとStartの要求はCookieを持つ。APIはこのJWTを独立して検証し、Cookie自体を認可しない。
  if (!headers.has("authorization") && props.sessionToken) {
    headers.set("authorization", `Bearer ${props.sessionToken}`);
  }

  const client = createTRPCClient<AppRouter>({
    links: [
      httpLink({
        url: new URL("/api/trpc", props.request.url).href,
        headers: () => Object.fromEntries(headers),
        fetch: props.fetch,
      }),
    ],
  });
  try {
    const registration = await client.access.registration.query({ service: props.service });
    if (!registration.registered) {
      return "unregistered";
    }

    if (props.input.qualified) {
      const session = await client.access.session.query({ service: props.service });
      // 別タブの退会・再登録をまたいだ応答を利用資格として組み合わせない。
      if (registration.accountId !== session.userId) {
        return "unavailable";
      }
    }

    return "registered";
  } catch (error) {
    return accessFailureState(error);
  }
}

function accessFailureState(error: unknown): RouteAccessState {
  if (!(error instanceof TRPCClientError)) {
    return "unavailable";
  }

  if (error.data?.code === "UNAUTHORIZED") {
    return "signed-out";
  }

  if (error.data?.code === "FORBIDDEN") {
    return "forbidden";
  }

  return "unavailable";
}
