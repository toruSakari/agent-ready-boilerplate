import { createCsrfMiddleware, createStart } from "@tanstack/react-start";
import { startFunctionLogging, startRequestLogging } from "@dev-template/config/start-logging";

export const startInstance = createStart(() => ({
  // Start設定を自分で定義すると既定のCSRF処理は追加されないため、server functionの保護を明示する。
  requestMiddleware: [
    startRequestLogging,
    createCsrfMiddleware({ filter: (context) => context.handlerType === "serverFn" }),
  ],
  functionMiddleware: [startFunctionLogging],
}));
