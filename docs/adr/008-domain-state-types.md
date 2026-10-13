# ADR 008: 状態付きエンティティのTypestateと幽霊型

## ステータス

採用。ADR 006の状態遷移を型でも制御し、ADR 007のステータスマスタ・保存構成は維持します。
値の検証・エンティティの入力は[ADR 009](009-domain-value-objects.md)のValue Objectで扱います。

## 背景

注文・決済・在庫予約には状態ごとに許可される操作があり、実行時の検証に加えて型でも区別します。
DBの文字列・JSONをそのまま信頼せず、復元時に不正な状態を拒否する必要があります。

## 決定

状態を持つエンティティは状態を型パラメーターとして持ち、ランタイムに存在しないprivateの
stateBrand（幽霊型のブランド）で状態同士を区別します。公開コンストラクターは置きません。
具体的なファクトリーまたは検証付きrestoreだけがインスタンスを作ります。

| エンティティ     | 初期状態                     | 許可する遷移                                                              |
| ---------------- | ---------------------------- | ------------------------------------------------------------------------- |
| Order            | draft、直接作成時はconfirmed | draft→confirmed/cancelled、confirmed→shipped/cancelled、shipped→completed |
| Payment          | pending                      | pending→authorized/failed/voided、authorized→captured/failed/voided       |
| StockReservation | reserved                     | reserved→committed/released、committed→restored                           |

各メソッドはthisの型で遷移元を限定し、遷移先の型を持つ新しいエンティティを返します。
汎用transition(status)は置きません。Orderにはupdate・confirm・ship・complete・cancel、Paymentには
authorize・capture・fail・void、StockReservationにはcommit・release・restoreStockを置きます。
メソッド内でも状態を検証し、TypeScriptを経由しない呼び出しや型の偽装を実行時に拒否します。
エンティティは凍結し、元の値を変更しません。スナップショットは通信・保存用の値で、エンティティそのものではありません。

```ts
const draft = OrderEntity.draft(input); // OrderEntity<"draft">
const confirmed = draft.confirm(event); // OrderEntity<"confirmed">
const shipped = confirmed.ship(event); // OrderEntity<"shipped">
const completed = shipped.complete(event); // OrderEntity<"completed">

// completed.cancel(event);      // コンパイルエラー
// confirmed.update(lines, event); // コンパイルエラー
```

### 命名

状態別インスタンスの共用型には業務名のOrder・Payment・StockReservationを使い、
実装クラスはOrderEntity<S>・PaymentEntity<S>・StockReservationEntity<S>とします。
共用型にAny接頭辞を付けません。通常の引数・戻り値には共用型を使い、状態を限定したい
箇所では実装クラスの型引数を指定します。ファクトリー・復元は実装クラスから呼び出します。

### 復元とユースケース

保存データはRepository・永続化アダプターでunknownとして受け取り、識別情報・状態・日時の形式を検証し、
数値・文字列からValue Objectを作成します。Entityのrestoreはブランド型を持つ復元入力を受け取り、
状態固有の必須情報や値同士の関係を検証します。EntityにDB行・JSONの解釈や値の再検証を置きません。
Orderは明細と合計、更新番号、下書きの予約禁止、確定済みの予約IDを検証します。
Paymentは承認済みの承認ID、失敗した支払いの理由などを検証します。
復元結果はOrder、Payment、StockReservationという、状態別インスタンスの判別可能な共用型です。
OrderEntity<OrderStatus>のような広い単一の型へ潰さず、statusで絞ってから操作します。

```ts
const order = await orders.find(tenantId, orderId); // Order | null
if (order?.status === "draft") {
  const next = order.confirm(event); // OrderEntity<"confirmed">
  await orders.update(next, order.version);
}
```

集約Repositoryのインターフェースは各業務領域の`domain/<業務領域>/repositories`に置き、
一覧もRepositoryを使い、外部Gatewayなどはapplicationに置きます。
集約Repositoryはエンティティを受け取り、取得時もエンティティを返します。D1OrderRepositoryの
findがJSON・DB行の復元を完了し、ユースケースはrestoreを呼びません。保存用スナップショットへの
変換はRepository内部、API・コンテキスト間の値への変換はユースケースの出力境界で行います。
注文に従う決済表示の同期はPaymentRepositoryがPaymentを受け取り、内部で保存形式へ変換します。ProductRepositoryは
検証済みProductを一覧でも返します。注文一覧もOrderRepositoryがOrderを返し、決済状態・表示名はPaymentState・OrderStatusEntityからapplicationでDTOへ結合します。UseCaseへQueryポートは注入しません。

APIの操作要求はユースケースで状態を絞り、具体的なメソッドへ振り分けます。
禁止された注文操作は日本語の409、入力の業務検証は400になります。
DBからの不正な復元値は内部障害として扱い、500の共通文言だけを公開します。
型アサーションで復元・状態の絞り込みを省略しません。

### 在庫の集約と永続化

InventoryItemは現在庫数と有効なStockReservationEntity<"reserved">の集合を持ちます。
予約の確定・解放には、この集約から取得した予約エンティティを渡します。
集約はSKU・ID・数量と現在の存在を確認し、別SKUの予約や古い予約による二重減算を拒否します。

InventoryRepositoryはD1台帳とDO予約を合わせてInventoryItemを検証・復元し、変更後のEntityを保存します。
D1の現在庫と割当を扱うD1InventoryLedgerはinfrastructure/sharedの内部部品とし、applicationやDOへ保存形式を公開しません。
D1のfindAllocationは復元・検証済みのcommittedまたはrestoredの予約エンティティを返します。
DOの予約ID→数量の形式とD1の割当テーブルは維持します。読み込み時に予約中のエンティティを作り、
確定済み割当はcommitted、restored_atがある割当はrestoredとして復元します。
取消印に加えて解放済みの予約IDもDOへ記録し、終わったIDへの再予約を409で拒否します。
取消・解放済みIDへの遅延確定は何も変更しません。解放済み・取消済みの印は再配信に備えて保持します。
過去に解放されたIDの履歴は復元できないため、この保護は新しく記録されたIDから適用します。
確定済み割当をDELETEで解放することは409で拒否し、取消の復元経路を使います。

### 状態を持たない商品

Productには業務ライフサイクルを追加しません。保存データは永続化アダプターで検証してValue Objectへ変換し、
Productクラスのcreate・restoreはブランド型を持つ値を受け取り、凍結したEntityを返します。画像の有無を便宜的な注文・決済のような状態機械にはしません。
公開・停止等を業務要件として追加する場合に、状態モデルを設計します。

## 選択肢

- 実行時の検証だけ：保存・API境界には必要ですが、内部の禁止操作をコンパイル時に検出できません。
- 型だけで制御：JSON・DB値・JavaScript呼び出しを保証できません。
- Typestateと幽霊型、実行時の検証を併用：内部の操作と復元境界の両方を保護できるため採用。

## 検証・影響・制約

- state-types.typecheck.tsで正常な戻り値型と復元後の絞り込みを確認します。禁止操作は
  ThisParameterTypeと型の代入可能性をAssert型で検証します。意図的な不正呼び出しや型エラーの
  抑制コメントを置かず、禁止操作が許可されると型チェックが失敗します。このファイルは実行時に読み込みません。
- 実行時の禁止操作はテスト専用invokeRuntimeでReflect経由のJavaScript呼び出しを再現します。
  型の偽装や抑制コメントは使いません。通常のコードは状態を絞り込んで直接メソッドを呼びます。
- 実行時テストで注文・決済・在庫予約の全ての状態と操作の組み合わせ、不正な復元値、異なるSKU、
  古い予約、解放済みIDへの再予約・遅延確定を確認します。
- ローカルD1・HTTP・画面E2Eで、更新競合、Outbox、在庫復元、デモ決済の既存フローを維持することを確認します。
- DBマイグレーションは不要です。APIのステータスコード・スナップショット形式・マスタ表示名を維持します。
  DOへ解放済みマーカーを保存します。マーカーの保持期間と削除は古い再配信の保証と一緒に設計します。
- 幽霊型は所有権を消費する型ではありません。古いインスタンスを手元に残せるため、DB更新番号、
  DOの直列化、冪等な割当・復元が引き続き必要です。並行処理や分散トランザクションを型だけで解決しません。
- 実決済、返品返金、予約の自動期限切れなど、ADR 006の未実装範囲は継続します。
