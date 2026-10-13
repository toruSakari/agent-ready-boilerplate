import type { RouterInputs, RouterOutputs } from "@dev-template/api-types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { QUERY_POLICY } from "#client/_app/providers/query-policy";
import { useTRPC } from "#client/shared/api/trpc";

function useQualificationFreshness(checkedAt: number) {
  const [now, updateFreshness] = useState(() => Date.now());
  useEffect(() => {
    if (!checkedAt) {
      return;
    }

    // 古い方の応答を基準にし、オフラインでも資格の鮮度切れを表示へ反映する。
    const timeout = setTimeout(
      () => updateFreshness(Date.now()),
      Math.max(0, checkedAt + QUERY_POLICY.sessionMaxAgeMs - Date.now()) +
        QUERY_POLICY.sessionExpiryTimerPaddingMs,
    );
    return () => clearTimeout(timeout);
  }, [checkedAt]);
  return checkedAt > 0 && now - checkedAt >= QUERY_POLICY.sessionMaxAgeMs;
}

function useResetChangedAccount(accountChanged: boolean) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!accountChanged) {
      return;
    }

    // 退会・再登録をまたいだ登録と旧権限の応答を組み合わせない。
    void queryClient
      .cancelQueries(trpc.access.pathFilter())
      .then(() => queryClient.resetQueries(trpc.access.pathFilter()));
  }, [accountChanged, queryClient, trpc]);
}

export function useServiceQualification(service: RouterInputs["access"]["session"]["service"]) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // 未登録者向けの案内に業務セッションは不要。独立した資格状態を定期確認する。
  const registration = useQuery(
    trpc.access.registration.queryOptions(
      { service },
      { throwOnError: false, refetchInterval: QUERY_POLICY.sessionRefreshIntervalMs },
    ),
  );
  const session = useQuery(
    trpc.access.session.queryOptions(
      { service },
      {
        enabled: registration.isSuccess && registration.data.registered,
        throwOnError: false,
        refetchInterval: QUERY_POLICY.sessionRefreshIntervalMs,
      },
    ),
  );
  const accountChanged = accountsDiffer(registration.data, session.data);
  useResetChangedAccount(accountChanged);
  const expired = useQualificationFreshness(
    Math.min(registration.dataUpdatedAt, session.dataUpdatedAt),
  );
  const error = registration.error ?? (registration.data?.registered ? session.error : null);
  const checking = qualificationIsPending(
    registration.isPending,
    registration.data?.registered,
    session.isPending,
    expired,
    accountChanged,
  );
  const retry = async () => {
    await queryClient.cancelQueries(trpc.access.pathFilter());
    const result = await registration.refetch();
    if (result.data?.registered) {
      await session.refetch();
    }
  };
  return { registration: registration.data, error, checking, retry };
}

function accountsDiffer(
  registration: RouterOutputs["access"]["registration"] | undefined,
  session: RouterOutputs["access"]["session"] | undefined,
) {
  return !!(registration?.registered && session && registration.accountId !== session.userId);
}

function qualificationIsPending(
  registrationPending: boolean,
  registered: boolean | undefined,
  sessionPending: boolean,
  expired: boolean,
  accountChanged: boolean,
) {
  return registrationPending || (registered && (sessionPending || expired || accountChanged));
}
