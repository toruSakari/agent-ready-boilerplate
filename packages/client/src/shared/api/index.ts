export { useTRPC, useTRPCClient, TRPCProvider } from "#client/shared/api/trpc";
export { useAuthenticatedFetch, ApiTokenProvider } from "#client/shared/api/authenticated-fetch";
export {
  useService,
  useOrganizationId,
  ServiceContext,
  OrganizationContext,
  OrganizationScope,
  type Service,
} from "#client/shared/api/client-context";
export {
  useAuthenticationStatus,
  AuthenticationContext,
  type AuthenticationStatus,
} from "#client/shared/api/authentication-context";
export {
  isForbiddenQueryError,
  perQueryAccessOptions,
  shouldThrowQueryError,
} from "#client/shared/api/query-access";
export { LIST_PAGE_SIZE } from "#client/shared/api/pagination-policy";
export { useCursorPagination } from "#client/shared/api/use-cursor-pagination";

export { useSuspenseOptionalQuery } from "#client/shared/api/use-suspense-optional-query";
