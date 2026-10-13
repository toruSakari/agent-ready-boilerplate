import { QueryObserver } from "@tanstack/react-query";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { RouterOutputs } from "@dev-template/api-types";
import { perQueryAccessOptions } from "#client/shared/api/query-access";
import { createScopedQueryClient } from "#client/_app/providers/session-cache";

// 実際のtRPCと同じ形のキーを使い、手続き名フィルターとサービス入力の扱いを検証する。
const sessionKey = [["access", "session"], { input: { service: "operator" }, type: "query" }];
const registrationKey = [
  ["access", "registration"],
  { input: { service: "operator" }, type: "query" },
];
const usersKey = [["access", "users"], { type: "query" }];
const clients: ReturnType<typeof createScopedQueryClient>[] = [];

function client() {
  const value = createScopedQueryClient();
  clients.push(value);
  return value;
}

const session = (
  permissions: RouterOutputs["access"]["session"]["platformPermissions"],
  userId = "account-a",
) => ({
  userId,
  channel: "admin",
  organizations: [],
  permissions: [],
  platformPermissions: permissions,
  permissionCatalog: {},
});
afterEach(() => {
  for (const value of clients.splice(0)) {
    value.clear();
  }

  vi.restoreAllMocks();
});

it(
  "スコープごとの権限キャッシュ" +
    " / " +
    "ログイン中の本人が同じでもサービス会員が変わったら以前のデータを破棄する",
  async () => {
    const cache = client();
    await cache.fetchQuery({
      queryKey: registrationKey,
      queryFn: async () => ({ registered: true, accountId: "account-a", category: "operator" }),
      staleTime: 0,
    });
    cache.setQueryData(usersKey, [{ email: "predecessor@example.test" }]);
    await cache.fetchQuery({
      queryKey: registrationKey,
      queryFn: async () => ({ registered: true, accountId: "account-b", category: "operator" }),
      staleTime: 0,
    });
    expect(cache.getQueryData(usersKey)).toBeUndefined();
  },
);

it(
  "スコープごとの権限キャッシュ" +
    " / " +
    "権限が狭まったら権限に依存するキャッシュ済み項目を破棄し、遅延中の古い取得を取り消す",
  async () => {
    const cache = client();
    await cache.fetchQuery({
      queryKey: sessionKey,
      queryFn: async () => session(["user.read", "user.personal.read"]),
      staleTime: 0,
    });
    cache.setQueryData(usersKey, [{ email: "private@example.test" }]);
    const oldRead = Promise.withResolvers<unknown>();
    const oldResult = cache
      .fetchQuery({ queryKey: usersKey, queryFn: () => oldRead.promise, staleTime: 0 })
      .catch(() => undefined);
    await cache.fetchQuery({
      queryKey: sessionKey,
      queryFn: async () => session(["user.read"]),
      staleTime: 0,
    });
    expect(cache.getQueryData(usersKey)).toBeUndefined();
    oldRead.resolve([{ email: "private@example.test" }]);
    await oldResult;
    expect(cache.getQueryData(usersKey)).toBeUndefined();
  },
);

it(
  "スコープごとの権限キャッシュ" +
    " / " +
    "使用中の権限依存データを再取得し、以前の遅れた取得結果は取り消されたままにする",
  async () => {
    const cache = client();
    await cache.fetchQuery({
      queryKey: sessionKey,
      queryFn: async () => session(["user.read", "user.personal.read"]),
      staleTime: 0,
    });
    const oldRead = Promise.withResolvers<{ email: string | null }[]>();
    const readUsers = vi
      .fn()
      .mockResolvedValueOnce([{ email: "private@example.test" }])
      .mockReturnValueOnce(oldRead.promise)
      .mockResolvedValue([{ email: null }]);
    // 購読を付けて実画面と同じactive状態を作り、reset後の再取得も含めて確認する。
    const observer = new QueryObserver(cache, { queryKey: usersKey, queryFn: readUsers });
    const unsubscribe = observer.subscribe(() => {});
    try {
      await cache.fetchQuery({ queryKey: usersKey, queryFn: readUsers });
      expect(cache.getQueryData(usersKey)).toEqual([{ email: "private@example.test" }]);
      const oldResult = observer.refetch();
      await cache.fetchQuery({
        queryKey: sessionKey,
        queryFn: async () => session(["user.read"]),
        staleTime: 0,
      });
      await vi.waitFor(() => expect(cache.getQueryData(usersKey)).toEqual([{ email: null }]));
      oldRead.resolve([{ email: "private@example.test" }]);
      await oldResult;
      expect(cache.getQueryData(usersKey)).toEqual([{ email: null }]);
      expect(readUsers).toHaveBeenCalledTimes(3);
    } finally {
      unsubscribe();
    }
  },
);

it(
  "スコープごとの権限キャッシュ" +
    " / " +
    "再検証した権限のスナップショットが変わらなければ業務データを破棄しない",
  async () => {
    const cache = client();
    await cache.fetchQuery({
      queryKey: sessionKey,
      queryFn: async () => session(["user.read", "member.read"]),
      staleTime: 0,
    });
    cache.setQueryData(usersKey, [{ name: "kept" }]);
    await cache.fetchQuery({
      queryKey: sessionKey,
      queryFn: async () => session(["member.read", "user.read"]),
      staleTime: 0,
    });
    expect(cache.getQueryData(usersKey)).toEqual([{ name: "kept" }]);
  },
);

it(
  "スコープごとの権限キャッシュ" + " / " + "入口の利用資格が正式に拒否されたら業務データを除去する",
  async () => {
    const cache = client();
    cache.setQueryData(usersKey, [{ email: "private@example.test" }]);
    await expect(
      cache.fetchQuery({
        queryKey: sessionKey,
        queryFn: async () => {
          throw Object.assign(new Error("revoked"), { data: { code: "FORBIDDEN" } });
        },
      }),
    ).rejects.toThrow("revoked");
    expect(cache.getQueryData(usersKey)).toBeUndefined();
  },
);

// 任意一覧の403、操作の拒否、401を分け、部分非表示と入口の再確認を混同させない。
it(
  "クエリ単位の権限拒否の扱い" +
    " / " +
    "任意セクションの取得が403になっても再試行、ポーリング、セッション更新を行わない",
  async () => {
    vi.useFakeTimers();
    const cache = client();
    const readSession = vi.fn(async () => session(["user.read"]));
    const sessionObserver = new QueryObserver(cache, {
      queryKey: sessionKey,
      queryFn: readSession,
    });
    const stopSession = sessionObserver.subscribe(() => {});
    await cache.fetchQuery({ queryKey: sessionKey, queryFn: readSession });
    cache.setQueryData(["readable-sibling"], ["keep"]);
    const readUsers = vi.fn(async () => {
      throw Object.assign(new Error("denied"), { data: { code: "FORBIDDEN" } });
    });
    const observer = new QueryObserver(cache, {
      queryKey: usersKey,
      queryFn: readUsers,
      ...perQueryAccessOptions,
      refetchInterval: 5_000,
    });
    const stop = observer.subscribe(() => {});
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(observer.getCurrentResult().status).toBe("error");
      await vi.advanceTimersByTimeAsync(60_000);
      await cache.invalidateQueries({ queryKey: usersKey });
      expect(readUsers).toHaveBeenCalledTimes(1);
      expect(readSession).toHaveBeenCalledTimes(1);
      expect(cache.getQueryData(["readable-sibling"])).toEqual(["keep"]);
    } finally {
      stop();
      stopSession();
      vi.useRealTimers();
    }
  },
);

it.each(["FORBIDDEN", "UNAUTHORIZED"])(
  "クエリ単位の権限拒否の扱い" +
    " / " +
    "通常の操作で %s が返された場合は引き続きセッションを更新する",
  async (code) => {
    const cache = client();
    const readSession = vi.fn(async () => session(["user.read"]));
    const observer = new QueryObserver(cache, { queryKey: sessionKey, queryFn: readSession });
    const stop = observer.subscribe(() => {});
    await cache.fetchQuery({ queryKey: sessionKey, queryFn: readSession });
    try {
      const mutation = cache.getMutationCache().build(cache, {
        mutationKey: ["action"],
        mutationFn: async () => {
          throw Object.assign(new Error("denied"), { data: { code } });
        },
      });
      await expect(mutation.execute(undefined)).rejects.toThrow("denied");
      await vi.waitFor(() => expect(readSession).toHaveBeenCalledTimes(2));
    } finally {
      stop();
    }
  },
);

it(
  "クエリ単位の権限拒否の扱い" +
    " / " +
    "任意セクションの取得が401になった場合は引き続きセッションを更新する",
  async () => {
    const cache = client();
    const readSession = vi.fn(async () => session(["user.read"]));
    const observer = new QueryObserver(cache, { queryKey: sessionKey, queryFn: readSession });
    const stop = observer.subscribe(() => {});
    await cache.fetchQuery({ queryKey: sessionKey, queryFn: readSession });
    try {
      await expect(
        cache.fetchQuery({
          queryKey: usersKey,
          meta: perQueryAccessOptions.meta,
          queryFn: async () => {
            throw Object.assign(new Error("unauthenticated"), { data: { code: "UNAUTHORIZED" } });
          },
        }),
      ).rejects.toThrow("unauthenticated");
      await vi.waitFor(() => expect(readSession).toHaveBeenCalledTimes(2));
    } finally {
      stop();
    }
  },
);
