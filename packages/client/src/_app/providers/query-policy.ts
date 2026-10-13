// 通信の再利用時間と資格を表示に使える最長時間は別にする。
// 再確認が停滞してもsessionMaxAgeMsを過ぎれば資格ガードが業務UIを取り下げる。
export const QUERY_POLICY = Object.freeze({
  // サーバーの単独実行契約に合わせ、会員ライフサイクル操作を混合バッチにしない。
  lifecycleBatchMaxItems: 1,
  rpcBatchMaxItems: 20,
  staleTimeMs: 30_000,
  sessionStaleTimeMs: 30_000,
  sessionRefreshIntervalMs: 30_000,
  sessionMaxAgeMs: 60_000,
  // 境界時刻ちょうどのタイマー丸めで期限判定の直前に再描画されるのを避ける。
  sessionExpiryTimerPaddingMs: 1,
  retryAttempts: 1,
});
