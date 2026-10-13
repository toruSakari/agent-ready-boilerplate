import type { inferRouterInputs, inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "#api/presentation/app-router.ts";

// 型生成の公開入口。クライアントは生成パッケージを参照し、このサーバー実装へ依存しない。
export type { AppRouter };

export type RouterInputs = inferRouterInputs<AppRouter>;

export type RouterOutputs = inferRouterOutputs<AppRouter>;
