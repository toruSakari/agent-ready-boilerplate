# ADR 034: DrizzleのクエリビルダーでD1へアクセスする

- ステータス: 採用
- 決定日: 2026-10-11

## 背景

Drizzleのスキーマがある一方、Access、注文の原子更新、画像管理、在庫復元にD1のprepareとSQL文字列が残っていた。列名・値変換の二重管理を避けながら、既存の競合制御・テナント分離・失敗時のロールバックを維持する必要がある。

## 決定

通常の読み書き・結合・サブクエリ・upsert・RETURNINGはDrizzleのクエリビルダーとスキーマ列を使う。保存データからEntityへの検証・復元は既存mapperの責務とし、Drizzleによる型付けだけでは代替しない。

D1の複数書き込みはDrizzle D1ドライバーのbatchへ渡す。Accessの期待版更新、注文の版比較、画像の変更条件を先行更新で確認し、後続操作にも勝者の条件を付ける。失敗時の一括ロールバックとOutbox・監査の原子保存を維持する。D1でBEGINを発行するtransactionへの置き換えは行わない。

通常のビルダーで表現できない箇所だけ、公式のsql拡張を使う。

- 条件付き定数行の挿入はinsert().select(sql)を使い、共通guardedInsertがスキーマ列の順序・既定値・値エンコーダーを参照する。使用対象は生成列・実行時defaultFnを持たない現在の永続化スキーマとする。
- NULLを含む画像キーの同一性はSQLiteのIS、注文明細の画像参照はjson_treeを使う。無効なJSONは削除を許可しない。
- 保存フラグの検証前にbooleanへ変換すると不正値を見逃すため、検証対象はraw列として読み取る。
- UNIONの計算列にはテーブル情報がないため、JOINで参照する際は固定の別名を明示する。会員所属のUNIONは企業・運営だけを対象とする。

## 理由と影響

列変更はスキーマを起点に追えるようになる。RepositoryはEntity入出力の契約を維持し、Query・R2実体保存・画像stage/清掃・独立した監査Storeの責務は統合しない。DB構造・API契約は変えないため、新しいマイグレーションは不要。

実D1・R2の結合テストで競合、招待失効、退会、画像の途中失敗と清掃、Outbox、在庫復元を検証する。条件付きINSERTにはboolean/default/SQL式/入力のパラメーター化、負けたupsert、batch失敗時のロールバックのテストを残す。

## 確認した公式資料

2026-10-11に以下の公式ドキュメントを確認した。Drizzleのbatch案内の対象DBだけでD1の保証を判断せず、利用中のdrizzle-orm 0.45.3のD1ドライバーがD1Database.batchへ委譲することとCloudflareの保証も照合した。

- [Select](https://orm.drizzle.team/docs/select): 列選択・JOIN・サブクエリ。
- [Insert](https://orm.drizzle.team/docs/insert): insert-select・upsert・RETURNING。
- [Update](https://orm.drizzle.team/docs/update): 更新条件・SQL式・RETURNING。
- [Operators](https://orm.drizzle.team/docs/operators): EXISTS・NOT EXISTS・IN。
- [Set operations](https://orm.drizzle.team/docs/set-operations): UNION ALL。
- [SQL](https://orm.drizzle.team/docs/sql): 型付きビルダーの拡張とパラメーター化。
- [Batch API](https://orm.drizzle.team/docs/batch-api): 複数ビルダーのbatch。
- [Cloudflare D1Database](https://developers.cloudflare.com/d1/worker-api/d1-database/): batchの逐次実行・全体ロールバック。
