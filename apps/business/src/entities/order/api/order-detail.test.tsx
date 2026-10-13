import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, act, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { ORDER_REFRESH_INTERVAL_MS } from "@dev-template/client/entities/order";
import { useBusinessOrder } from "#business/entities/order/api/order-detail.ts";

const state = vi.hoisted(() => ({ paymentStatus: "pending", requests: 0 }));
vi.mock("@dev-template/client/api", () => ({
  perQueryAccessOptions: {},
  useTRPC: () => ({
    order: {
      get: {
        queryOptions: () => ({
          queryKey: ["order", "get"],
          queryFn: async () => {
            state.requests += 1;
            return { paymentStatus: state.paymentStatus };
          },
        }),
      },
    },
  }),
}));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  state.paymentStatus = "pending";
  state.requests = 0;
});

function PaymentStatus() {
  const order = useBusinessOrder("order-a");
  return <p>{order.paymentStatus}</p>;
}

describe("企業注文詳細の非同期反映", () => {
  it.each(["authorized", "captured", "voided"])(
    "Queueによる決済更新%sを画面を再表示せず取り込む",
    async (paymentStatus) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity } },
      });
      // 初回描画を確定してから時計を進め、Suspenseの初回取得と定期取得を区別する。
      await queryClient.prefetchQuery({
        queryKey: ["order", "get"],
        queryFn: async () => ({ paymentStatus: "pending" }),
      });
      vi.useFakeTimers();
      render(
        <QueryClientProvider client={queryClient}>
          <PaymentStatus />
        </QueryClientProvider>,
      );
      expect(screen.getByText("pending")).toBeVisible();
      state.paymentStatus = paymentStatus;
      expect(state.requests).toBe(0);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(ORDER_REFRESH_INTERVAL_MS + 1);
      });
      expect(screen.getByText(paymentStatus)).toBeVisible();
      expect(state.requests).toBeGreaterThan(0);
      queryClient.clear();
    },
  );
});
