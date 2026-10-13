/** tRPCと同じくURLを復号して数え、エンコードされたカンマでも操作数制限を迂回させない。 */
export function rpcBatchSize(url: URL): number {
  if (url.searchParams.get("batch") !== "1") {
    return 1;
  }

  try {
    return decodeURIComponent(url.pathname.split("/").at(-1) ?? "").split(",").length;
  } catch {
    // 不正なURL符号はtRPCで拒否する。ここでは要求単位の枠を消費する。
    return 1;
  }
}
