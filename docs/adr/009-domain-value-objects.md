# ADR 009: 値の不変条件をValue Objectへ分離する

## ステータス

採用。ADR 008の状態型・Repositoryの復元境界を維持し、値そのものの検証を分離します。
Value Objectは一つの値だけを持つZodブランド型で実装します。EntityのクラスとTypestateは継続します。

## 背景

SKU・商品名・数量・単価・支払金額の検証を一箇所に集め、
検証前の値と検証済みの値を内部の型で区別する必要があります。
注文数量と現在庫数は許容範囲が異なり、共通のQuantityでは業務ルールを表せません。

Sku・ProductName・UnitPrice・各数量・金額・通貨は、単一の値の検証と保持が主な責務です。
クラスで包むとvalueの取り出しとequalsの実装が必要です。クライアントはtRPCから導出したDTOを
使うため、ドメインの値クラスを通信先で復元する必要はありません。

Zodのブランド型は検証済みの値を型で区別し、実行時の表現を数値・文字列のまま維持できます。
ブランド自体は静的な仕組みで、実行時の検証やクライアントでの再検証を代わりに行いません。

## 決定

検証付きcreateを持つValue ObjectをZodブランド型で実装し、検証した数値・文字列を
そのまま保持・比較します。型では普通のプリミティブ値や別用途の数量を代入できなくします。

| 配置                           | Value Object        | 値のルール               |
| ------------------------------ | ------------------- | ------------------------ |
| domain/shared/value-objects    | Sku                 | 空白だけを除き1〜64文字  |
| domain/shared/value-objects    | ProductName         | 空白だけを除き1〜120文字 |
| domain/shared/value-objects    | UnitPrice           | 0〜10000000の安全な整数  |
| domain/order/value-objects     | OrderQuantity       | 1〜100の整数             |
| domain/inventory/value-objects | StockQuantity       | 0以上の安全な整数        |
| domain/inventory/value-objects | ReservationQuantity | 1以上の安全な整数        |
| domain/payment/value-objects   | PaymentAmount       | 1以上の安全な整数        |
| domain/payment/value-objects   | CurrencyCode        | 大文字3文字の通貨コード  |

Sku・ProductName・UnitPriceは注文時点の商品情報と商品管理で意味・ルールが一致するため、
小さな共通ドメインとして共有します。別コンテキストの集約には依存しません。
業務ルールが分かれた場合はコンテキスト側の値型へ切り出します。CurrencyCodeは形式を検証し、実在するISO通貨や実決済サービスの対応通貨を保証するものではありません。

AccessのID・名前・メールアドレス・会員ID・認証主体ID・会員種別・操作権限・許可IP範囲も、単一値のブランド型を使います。
会員種別・権限の列挙コードとサービスごとの権限上限は`domain/access/policies`に置き、
API・Query・認可の要求コード・Typestateの識別子にはブランドなしのコード型を使います。
Membership・Invitation・Role・PlanDefinitionは、入力と復元の境界でcreateしたブランド型を保持します。
プラン定義・割当・注文明細は`entities`、権限計算・開発用カタログは`policies`、エラー型は`errors`に置きます。

### ブランド型の実装

スキーマへ`.brand<"業務上の型名">()`を付け、`z.infer<typeof schema>`でブランド付きの出力型を生成します。
`z.output<typeof schema>`も同じ出力型を表すため利用できます。型を手書きしてブランドを省略しません。
`schema.parse(value)`または`schema.safeParse(value)`の成功結果から値を作ります。
内容が妥当でも、検証前の値をブランド型へ直接代入することは型エラーになります。

次はブランド型の仕組みを示す一般例です。各失敗例は独立して評価します。
このリポジトリのValue Objectには、単一値のスキーマへ同じ手順を適用します。

```ts
import { z } from "zod";

const UserSchema = z
  .object({
    id: z.string().regex(/^[a-zA-Z0-9]{5}$/),
    name: z.string().min(3).max(15),
  })
  .brand<"User">();

type User = z.infer<typeof UserSchema>;

const userOK: User = UserSchema.parse({ id: "abc45", name: "Taro" });
// 実行時の検証エラー: IDの形式と名前の文字数が不正。
const userNG: User = UserSchema.parse({ id: "hoge!@#", name: "yu" });
// コンパイル時の型エラー: 内容は妥当でも、ブランド付きの検証結果ではない。
const user: User = { id: "abc45", name: "Taro" };
```

対象の値をZodのbrandで定義し、同じ名前で型とcreateファクトリーを公開します。
スキーマは各値のモジュール内に保持し、create(unknown)はsafeParseの成功結果を返します。
失敗は日本語のInvalidValueObjectErrorに変換し、ZodErrorを公開契約にしません。
この共通処理は`domain/shared/create-value.ts`に置き、各Value Objectのcreateから利用します。
スキーマ・業務制約・エラーメッセージは各Value Objectが所有します。
型アサーションやエラー抑制コメントでブランドを付けません。

```ts
const schema = z.number().int().min(1).max(100).brand<"OrderQuantity">();
export type OrderQuantity = z.infer<typeof schema>;

export const OrderQuantity = Object.freeze({
  create(value: unknown): OrderQuantity {
    return createValue(
      (input) => schema.safeParse(input),
      value,
      "数量は1以上100以下の整数にしてください",
    );
  },
});
```

- 単一の数値・文字列を検証する値はブランド型を標準とします。プリミティブ値自体は不変です。
- Value Objectに複数の値や設定を保持させず、クラスで実装しません。複数の値の関係・一覧の件数上限・設定の整合性はEntityが所有します。
- 許可IP・CIDR一件は`AllowedIpRange`の文字列ブランド型で表します。企業のIP制限の有効状態・許可一覧・空一覧禁止・最大50件の制約は`OrganizationEntity`が所有します。
- `pnpm check`の`project/single-value-object`でValue Object配下のクラス・複合スキーマ・ブランドなしの型を拒否します。全18種類の単一値と未検証値の代入禁止は`tests/domain-value-objects.typecheck.ts`で確認します。
- Value Objectは1ファイル1VOとし、スキーマ・型・createを同じ一組として保持します。共有の制約・基底スキーマは定義元を参照します。
- Entityはクラスとし、状態遷移を持つものにはTypestateを使います。明細もOrderLineクラスで保持し、Entityと配列をObject.freezeで凍結します。
- 数値・文字列の値比較は===で行います。
- 数量の加算等の演算結果は通常のnumberになります。ドメイン値として保持・受け渡す前に、
  対応するcreateで再検証します。StockQuantityとReservationQuantityを同じQuantityには統合しません。

### エンティティの入力と責務

OrderEntityの明細はSku・ProductName・OrderQuantity・UnitPriceを受け取り、内部にも保持します。
StockReservationEntityはSku・ReservationQuantity、InventoryItemはSku・StockQuantityと有効な予約を
保持し、予約・在庫変更でそれぞれの数量型を受け取ります。PaymentEntityはPaymentAmount・CurrencyCode、
ProductもSku・ProductName・UnitPriceを保持します。プリミティブ値との互換オーバーロードは置きません。

```ts
const draft = OrderEntity.draft({
  ...identityAndEvent,
  lines: [
    new OrderLine(
      Sku.create("SKU-1"),
      ProductName.create("マグ"),
      OrderQuantity.create(2),
      UnitPrice.create(1200),
    ),
  ],
});
```

Value Objectは値自体のルール、エンティティは値同士・状態との関係を扱います。
注文の明細件数・SKU重複禁止・合計の整合性・状態遷移、在庫の予約重複・予約数と現在庫数の関係・
異なるSKUや古い予約の拒否、支払い状態と承認IDの関係はエンティティに残します。
在庫のSKU・数量比較はプリミティブ値の===で行います。

### 実行時の検証

API入力・Repository復元では同じcreateを使い、未検証の値をブランド型へ変換します。
Entityの通常の作成・値変更は検証済みのブランド型を受け取り、値自体を再検証しません。
内部のTypeScriptコードでは型契約を信頼します。数値の演算結果はブランドを失うため、
ドメイン値として保持する前にcreateで再検証します。
ブランドは実行時には存在せず、型を無視したJavaScript・Reflect呼び出しの値検証は保証しません。
状態遷移の実行時ガードは維持します。保存データのunknownはRepository・永続化アダプターで検証します。
注文の重複SKU・合計、予約と在庫の関係、状態遷移等は引き続きEntityの責務です。

### 復元と通信・保存の境界

APIの入力は文字列・数値で受け取り、ユースケースの入力境界でValue Objectを作成します。
注文明細は入力境界で単一値のValue Objectを作成し、OrderLineクラスへ渡します。保存値は
restoreStoredOrderLineで検証して同じクラスへ復元します。保存済み集約の復元は永続化アダプターが担当します。
商品作成の前後空白除去は入力境界で行い、保存値の復元では暗黙に正規化しません。

Repositoryの取得では永続化アダプターがunknownの保存データを検証し、Value Objectを作成します。
Entityのrestoreはブランド型を持つ復元入力を受け取り、合計・状態固有の必須項目など集約の整合性だけを確認します。
Repositoryは復元済みEntityを返し、ユースケースへ保存データの変換を持ち込みません。
DOのInventoryItemも台帳と予約を合わせて同じ値検証を使います。API応答・DB・ドメインイベントは
各EntityのtoSnapshotで文字列・数値へ変換します。DTOの
各フィールドにはプリミティブを指定し、ドメイン内部のブランドをAPI契約に漏らしません。DTO全体のブランドは[ADR 035](035-branded-dtos.md)に従います。クライアント型は引き続きtRPCから導出します。

Value Objectの不正入力はInvalidValueObjectError（日本語）を投げます。利用者の入力を変換する
境界で400へ対応させ、不正なDB・DOデータは500の共通文言にします。予期しない障害を400にしません。

### クライアントとフォーム

tRPC 11.19.0では、直接返したブランド型の出力にブランドが残る場合があります。JSON化すれば
型も自動で消えると仮定しません。packages/client/src/shared/api/client-types.typecheck.tsで注文・商品の入出力が
number・stringであることを検証します。通常のクライアントからブランド付き値を作る必要はありません。

フォーム編集中の値は検証済みの値と分けます。空文字や途中入力を画面状態として保持し、送信時に
入力を整えます。クライアントの入力検証だけでサーバーの検証を省略しません。tRPCの型推論は、
受信データをブラウザーでZod検証する処理ではありません。表示・キャッシュにはDTOを使います。

## 選択肢

- エンティティ内でプリミティブ値を検証：重複と未検証値の受け渡しが残るため採用しない。
- 汎用Quantityで全ての数量を表現：0の可否・注文上限を表せないため採用しない。
- 業務上の意味で分けたZodブランド型：用途の区別・共通の実行時検証・プリミティブな表現を両立するため採用。
- 全てをクラスにする：複雑な値の操作には適していますが、単純な値には包装・変換・比較のコードが増えるため採用しない。
- ブランドだけ付けて検証しない：保存データや型のない呼び出しを保証できないため採用しない。

## 検証・影響・制約

- 上下限、小数、非有限値、安全な整数の範囲外、型違い、空白・長さ、通貨の形式を検証します。
- 明細の凍結とプリミティブ値による比較、注文数量と予約数量の型の区別、エンティティの入力型を検証します。
  型エラーの抑制コメントや型アサーションは使いません。
- Repository復元、400／500、状態遷移、在庫の冪等処理、商品画像管理の既存フローを検証します。
- ブランドは実行時の識別子でもセキュリティ境界でもありません。検証・認可・更新競合・冪等処理を維持します。
- Zodは既存依存を使用し、新しい依存を追加しません。
- DBマイグレーション不要。API・保存スナップショット・イベントの形式と数値範囲を維持します。
- このADRの表は商品・注文・在庫・決済の値を扱います。会員IDは[ADR 016](016-service-account-domain-models.md)のブランド型で区別し、日時・状態・画像キーも責務を持つ境界で検証します。
- 返品返金、実決済、数量の単位換算、小数の金額などの業務要件は追加しません。

## 参考資料

- [Zodのブランド型](https://github.com/colinhacks/zod/blob/main/packages/docs/content/api.mdx#branded-types)
- [tRPCの入出力型推論](https://github.com/trpc/trpc/blob/main/packages/server/src/unstable-core-do-not-import/clientish/inference.ts)
- [TanStack Queryの標準設定と構造共有](https://tanstack.com/query/latest/docs/framework/react/guides/important-defaults)
