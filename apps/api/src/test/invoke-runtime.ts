// TypeScriptを使わない呼び出し元を再現し、実行時ガードだけを検証するテスト境界。
// 通常のドメイン呼び出しは型を維持し、禁止操作を本番で迂回する用途には使わない。
export function invokeRuntime(
  receiver: object,
  methodName: string,
  args: readonly unknown[] = [],
): unknown {
  const method: unknown = Reflect.get(receiver, methodName);
  if (typeof method !== "function") {
    throw new Error("呼び出すメソッドがありません");
  }

  return Reflect.apply(method, receiver, args);
}
