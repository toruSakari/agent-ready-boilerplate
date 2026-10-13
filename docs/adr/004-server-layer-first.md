# ADR 004: サーバーをレイヤーごとに配置する

## ステータス

採用。

## 背景

サーバーのコードを読むときに、同じ責務のコードをまとめて見つけられる構成にします。
DDDの業務境界を保ち、フレームワークの通信処理と業務ルールを分けます。

## 決定

`apps/api/src/`直下を`domain`・`application`・`infrastructure`・`presentation`に分け、
その下に`order`・`inventory`・`product`・`payment`などの業務領域を置きます。
実装があるレイヤーだけを作り、テストは対象と同じ階層に置きます。

domainは責務で次のように分けます。

```text
domain/
  order/
    entities/order.ts
    entities/order-line.ts
    value-objects/order-quantity.ts
    repositories/order-repository.ts
    events/domain-event.ts
  shared/
    value-objects/sku.ts
    validation.ts
```

Payment・Productの集約Repositoryの契約も、それぞれの`repositories`に置きます。
EntityとValue Objectのテストは実装と同じディレクトリに置きます。共通の型契約は
`domain/shared/state-types.typecheck.ts`に置き、共通の値型は`shared/value-objects`で管理します。
実装のないディレクトリは追加しません。

集約RepositoryはEntityの永続化契約なのでdomainが定義し、applicationとinfrastructureが参照します。
外部Gateway、画像Storage、独立した監査追記Store、Outbox配信などユースケースのための
契約はapplicationに残します。D1などの具体的実装と保存データの検証・変換はinfrastructureに置きます。
applicationからdomainのRepositoryを再公開する互換経路は作りません。

applicationは用途を読み取れるディレクトリ名で分けます。

```text
application/order/
  use-cases/create-order-use-case.ts
  dtos/create-order-input.ts
  dtos/order-output.ts
  gateways/inventory-gateway.ts
  messaging/event-publisher.ts
```

業務操作は`*UseCase`／`*UseCases`として`use-cases`へまとめ、汎用の`*Service`名を使いません。
共通の本人確認・会員解決はProvider、複数操作で使う認可はPolicyとして扱います。
認可チェックをUseCaseへ包まず、操作固有の所有・状態の制約はUseCaseにも残します。
DTO・Provider・Policyは役割ごとのディレクトリへ置き、補助処理を業務領域の直下や`use-cases`へ混在させません。

```text
application/auth/
  providers/account-identity-provider.ts
  providers/identity-provider.ts
  providers/service-identity-provider.ts
  policies/prepare-authorized-actor.ts
  policies/assert-service-entry.ts
  policies/permissions.ts
  contracts/identity.ts
  contracts/authorized-actor.ts
  contracts/service-actor.ts
  contracts/authorization-grant.ts
  schemas/authorized-actor-schema.ts
```

共有するデータ契約は`contracts`、検証は`schemas`、Entity・DTO変換は`mappers`、
共通の補助処理は所有する領域の`shared`へ置きます。全体のDI契約は`application/container.ts`、
業務領域をまたぐ共通処理は`application/shared`として扱います。テストは対象と同じ場所へ置きます。

UseCaseは入力DTOを受け取り、出力DTOを返します。Controllerが入力を検証してDTOを生成し、
UseCaseがRepositoryから受け取ったEntityを出力DTOへ変換します。UseCaseはHTTPのRequestや
フレームワークのContextを受け取らず、永続化読取にQueryポートを注入しません。
DTOはZodブランド型とし、型アサーションでブランドを付けません。詳細は
[DTOの判断](035-branded-dtos.md)と[実装規約](../project-guide.md#applicationの実装と外部依存の契約)を参照してください。

集約Repositoryの契約はdomainの`repositories`、Gateway・Storage・Store・配信などの
外部依存の契約はapplicationの役割別ディレクトリに置きます。

`application/container.ts`のApplicationContainerは、UseCaseクラス・AccessRepository・ServiceIdentityProviderをまとめるDIの型です。
UseCaseと同じメソッドを宣言するインターフェースや型エイリアスは作りません。
API・Queueの接続はComposition Rootで行い、イベント処理のファクトリーもUseCaseクラスを返します。
Repository・Gateway・Storageなどは外部依存やコンテキスト境界の契約として維持します。
注文と決済の連携はOrderPaymentSynchronizerを通じ、決済の実装クラスを注文UseCaseへ直接取り込みません。
商品画像の容量制約はapplication/product/policies/image-policy.tsに置きます。
契約は用途を表す名前で定義します。

共通のIdentityは`application/auth/contracts/identity.ts`、IdentityProviderは`application/auth/providers/identity-provider.ts`、
Clerk・デモ認証アダプターは`infrastructure/auth/providers/`に置きます。Durable Objectの在庫予約アダプターは
`infrastructure/inventory/durable-objects/`に配置します。依存の接続は引き続き`composition-root.ts`で行います。

infrastructureは役割で分けます。

```text
infrastructure/
  order/
    repositories/d1-order-repository.ts
    gateways/inventory-do-gateway.ts
    messaging/queue-event-publisher.ts
    messaging/order-event-consumer.ts
    schemas/schema.ts
    mappers/restore-stored-order.ts
  product/
    repositories/d1-product-repository.ts
    storage/r2-product-image-storage.ts
  inventory/
    repositories/d1-do-inventory-repository.ts
    shared/d1-inventory-ledger.ts
    repositories/d1-stock-adjustment-repository.ts
    shared/initial-stock-statements.ts
    durable-objects/inventory-reservation.ts
  auth/
    providers/clerk-identity-provider.ts
```

DBスキーマは`schemas`、保存データの検証・Value Objectへの変換は`mappers`に置き、RepositoryやStoreから利用します。
在庫集約の保存と履歴の復元は`repositories`、D1保存形式と商品登録時の初期INSERT組み立ては`shared`に置きます。共通の保存値の形式検証は
`infrastructure/shared/mappers/persisted-values.ts`に置きます。テストも実装と同じディレクトリに置きます。
Drizzleのスキーマ設定とWorkerエントリーは実際の配置を参照します。

本人確認・会員照会を組み合わせる`AccountIdentityProvider`は`application/auth/providers/account-identity-provider.ts`へ置きます。
会員解決と現在権限の方針を所有するため、実装と単体テストをapplicationに置きます。外部認証は`IdentityProvider`、
DB照会は`AccessQuery`を通し、D1・Clerk・Cloudflareの具体的アダプターはinfrastructureに残します。

applicationの既知のエラーはフレームワーク非依存のApplicationErrorを使い、presentationでtRPCやHTTPへ変換します。
フレームワーク移行時はpresentation・具体的アダプター・Composition Rootを差し替え、UseCaseクラスと外部依存の契約を再利用します。
Request・ArrayBuffer・ReadableStreamなど標準Web APIの値を契約で使うため、移行先でもそれらを扱える必要があります。

presentationも業務領域と通信上の役割をファイル名で区別します。
配置は次のとおりです。

```text
presentation/
  api-app.ts
  app-router.ts
  access/
    trpc-router.ts
    middleware/trpc-authorization.ts
  order/trpc-router.ts
  product/
    trpc-router.ts
    image-input.ts
    image-output.ts
  shared/
    trpc-core.ts
    errors.ts
    middleware/
      authentication.ts
      trpc-authorization.ts
      limit-trpc-body.ts
```

各領域の`trpc-router.ts`はその領域の操作だけを所有し、`app-router.ts`が公開名で接続します。
`api-app.ts`は共通ヘッダー・エラー・公開ヘルス・RPC入口を持ちます。
`shared/trpc-core.ts`はtRPCの初期化・Context生成・共通エラー変換を持つprocedureの基盤に限定します。
本人確認は`shared/middleware/authentication.ts`、共通の会員・権限ガードは同じディレクトリの
`trpc-authorization.ts`に置き、coreから再公開しません。Access専用の対象範囲・状態スナップショットの認可と
その入力契約は`access/middleware/trpc-authorization.ts`に置き、sharedへ業務固有の処理を戻しません。

画像のFormData検証は`product/image-input.ts`、上限付き読込みと応答変換は`product/image-output.ts`に分けます。
画像アップロードの実バイト数制限は共通tRPC入口の`shared/middleware/limit-trpc-body.ts`が担当し、
認可後の本文解析まで読み出しを遅らせます。画像の容量・解析順序・公開契約の判断はADR 021に従います。
Cloudflare AccessのJWT署名・JWK取得は外部認証アダプターなので
`infrastructure/auth/providers/cloudflare-access-verifier.ts`に置き、通信境界から呼び出します。
テストは実装と同名・同階層に置き、全体の公開操作一覧は`app-router.test.ts`で確認します。
レイヤーの責任とコンテキストの境界を維持し、別コンテキストの集約は直接参照せず、
ポート・ID・値・イベントで連携します。画像の通信契約と容量制限は[ADR 021](021-product-image-trpc.md)を参照してください。

## 選択肢

- コンテキストを先頭にする配置：一つの業務領域を変更するときに関連コードを集めやすい。
- レイヤーを先頭にする配置：同じ技術的責務のコードを一覧しやすい。レイヤーごとの責務を確認しやすい。
- レイヤー内に全ファイルを平置きする配置：`ports.ts`や`schema.ts`が衝突し、業務の所属も分かりにくい。

## 影響

- レイヤーの役割をディレクトリの先頭で確認できます。
- 一つの業務領域を変更する際には、複数のレイヤーディレクトリを行き来します。
- 将来コンテキストをパッケージへ切り出す場合は、各レイヤーの対象領域をまとめて移動します。

## 受け入れ条件

- 注文・在庫・商品・決済のコードと既存テストが担当レイヤー配下にある。
- 既存テストで注文作成、認可、在庫・決済の状態遷移、商品画像管理の振る舞いを確認できる。
- 整形・lint・型チェックとWorkerのビルドが成功し、APIとDurable Objectの公開が維持される。
