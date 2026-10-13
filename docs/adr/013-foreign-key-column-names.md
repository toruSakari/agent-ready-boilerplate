# ADR 013: 外部キー列を参照先テーブル名に統一する

## ステータス

採用。SQLの外部キー列名から参照先テーブルを読み取れる命名を使います。

## 背景

外部キー列の名前から参照先テーブルを判別し、業務上の名前と保存上の参照関係を区別します。

## 決定

SQLの外部キー制約を持つ列は、参照先の実テーブル名に`_id`を付けます。
テーブル名の複数形もそのまま使い、Drizzleのプロパティは対応するcamelCaseにします。

現行の会員所属も同じ規則を使い、`customer_memberships.customer_accounts_id`は
`customer_accounts.id`、`business_memberships.business_accounts_id`は`business_accounts.id`、
`operator_memberships.operator_accounts_id`は`operator_accounts.id`を参照します。
サービス会員・所属の定義は[ADR 015](015-independent-service-accounts.md)に従います。

`permissions_id`と`order_statuses_id`の値は既存の文字列コードのままです。
参照先の主キー`code`を`id`に変更したり、新しい数値IDを追加したりしません。
列型、主キー、NULL可否、参照先、更新・削除時の動作、一意性は維持します。
既存のインデックス名も維持し、対象列だけが改名に追従します。

0012マイグレーションでは8列を改名します。企業の`tenant_id`・`scope`、
決済・処理済み履歴の`order_id`、在庫割当の予約IDなど、SQL外部キーを持たない論理参照は変更しません。
新しい制約は追加せず、API・ドメインの`userId`・`roleId`・`productId`・`status`などの業務名も維持します。

## 移行と配備

### 0012の対象列

以下は0012適用時の照合表です。`memberships`などの共有会員テーブルは0014以降の認証には使いません。

| 所属テーブル             | 旧列名      | 新列名            | 参照先              |
| ------------------------ | ----------- | ----------------- | ------------------- |
| memberships              | user_id     | accounts_id       | accounts.id         |
| memberships              | role_id     | access_roles_id   | access_roles.id     |
| role_permissions         | role_id     | access_roles_id   | access_roles.id     |
| role_permissions         | permission  | permissions_id    | permissions.code    |
| invitations              | role_id     | access_roles_id   | access_roles.id     |
| order_status_assignments | order_id    | orders_id         | orders.id           |
| order_status_assignments | status_code | order_statuses_id | order_statuses.code |
| product_images           | product_id  | products_id       | products.id         |

`0012_referenced_table_fk_columns.sql`は、8つの`ALTER TABLE ... RENAME COLUMN`で
既存行をその場で改名します。公開済みの0000〜0011と過去のスナップショットは書き換えません。
テーブルを作り直さず、画像キー・保持期限・清掃の確保情報を含む全保存値を維持します。

0012はテーブル再作成や存在しない列の読み取りを避けるカスタムSQLを使います。
現行スキーマのスナップショットはDrizzleで生成します。
再生成で追加差分がないことと、スナップショット・ORM定義・移行後DBの一致を検証します。

旧APIは旧列名を参照するため、移行後は互換性がありません。D1をバックアップし、APIの受付・
Queue consumer・定期実行など旧コードからDBへアクセスする処理を停止してから、0012まで適用します。
新APIを配備して認証・所属・権限・注文・画像を確認し、処理を再開します。
旧APIへ戻す場合は、停止中に逆方向の列改名を実施するか整合するバックアップを復元する必要があります。
移行とAPI配備の間を通常稼働のまま通過しないでください。
本番配備前の`db:preflight`とPreviewスクリプトの事前確認は、旧列が1つでも残っていれば移行前に停止します。
手動の停止・移行・新API配備を完了してから再開します。Previewの共有D1はすべてのPRの旧APIが対象です。

## 選択肢

- 単数形の業務名を残す：参照先テーブル名と一致しないため採用しません。
- 参照先をすべて数値idへ変更する：列名統一の範囲を超え、既存のコード値やAPIへ影響するため採用しません。
- 参照先テーブル名＋`_id`へ改名する：参照先を読み取れ、既存のデータと制約を維持できるため採用します。

## 検証と影響

旧列名で全8関係を持つ既存DBを用意し、移行前後の全行・列属性・インデックス・FK定義を比較します。
新規DBの全マイグレーション適用、コード値の保持、不正参照と重複の拒否、注文削除のCASCADEと
参照中のマスタ・商品削除のRESTRICTも確認します。
Repository・seed・初期管理者登録SQL・既存の所属／招待／注文／画像テストは新列名で動かします。
実環境のDB移行・配備は、承認された運用作業として実施します。
