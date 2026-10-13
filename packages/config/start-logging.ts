import { createMiddleware } from "@tanstack/react-start";

// serverコード内で読み込み、Nodeの要求ストアをブラウザへ持ち込まない。
export const startRequestLogging = createMiddleware().server(async (props) => {
  const { observeRequest } = await import("#config/request-logging.js");
  return observeRequest("start", props.request, props.next, (result) => result.response.status);
});

export const startFunctionLogging = createMiddleware({ type: "function" }).server(async (props) => {
  const { observeServerFunction } = await import("#config/request-logging.js");
  return observeServerFunction(props.method, props.next);
});
