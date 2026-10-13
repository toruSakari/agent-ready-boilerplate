# E2Eの作業ルール

- 利用者が観測できる画面フローを検証する。内部実装の詳細に依存するアサーションを避ける。
- `playwright.config.ts`と既存のデモ認証・データ準備方法を先に確認する。
- 権限不足・入力エラー・テナント分離も変更対象に応じて検証する。
- 固定sleepで待たず、Playwrightのlocatorと状態待機を使う。
- 関連specは`pnpm exec playwright test e2e/<対象>.spec.ts`で実行する。
  本番リソースへの書き込みをテスト準備に使わない。
