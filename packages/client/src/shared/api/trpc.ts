"use client";

import { createTRPCContext } from "@trpc/tanstack-react-query";
import type { AppRouter } from "@dev-template/api-types";

// 実行時のサーバーコードを取り込まず、生成済みの公開API型だけで通信契約を共有する。
export const { TRPCProvider, useTRPC, useTRPCClient } = createTRPCContext<AppRouter>();
