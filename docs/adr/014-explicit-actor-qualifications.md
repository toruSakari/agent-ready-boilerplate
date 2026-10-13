# ADR 014: サービス会員と操作権限の参照先

## ステータス

現行の会員・認可設計は次のADRに定義します。この文書は既存リンクからの案内を担います。

## 現行設計

- [ADR 015](015-independent-service-accounts.md): 通常・企業・運営の独立した会員、所属、登録・退会
- [ADR 016](016-service-account-domain-models.md): サービス別エンティティとユースケース
- [ADR 018](018-url-independent-procedure-authorization.md): 共通`/api/trpc`での本人確認と手続きごとの会員・現在権限の検証
- [ADR 019](019-frontend-request-authentication.md): 画面のroute group・layoutとClerkセッション同期
- [ADR 020](020-plan-permission-caps.md): プランによる実効権限の上限

## データ移行

保存済みのSQLマイグレーションは書き換えません。既存DBを利用する場合は、
[配備手順](../cloudflare.md)とADR 015の0014前進移行に従い、必要な対応表・停止条件・事前検査を確認します。
過去の資格テーブルを現行の入場判定や会員の自動分類には使いません。
