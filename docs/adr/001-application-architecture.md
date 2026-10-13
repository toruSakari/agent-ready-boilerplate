# ADR 001: 手動Composition Rootを用いたDDDモジュラーモノリス

## ステータス

採用。アプリとパッケージの境界は[ADR 010](010-multi-app-organization-access.md)、
サーバーの配置は[ADR 004](004-server-layer-first.md)に従います。

## 背景

業務ルールをフレームワークや配備構成から分離し、依存関係をコードから追える構成にします。

## 決定

pnpm workspaceに共通APIと3つの画面アプリを置きます。APIのDDDコードは`apps/api/src`に置き、
`domain`・`application`・`infrastructure`・`presentation`の各レイヤー内でコンテキストごとに整理します。
API WorkerにHono・tRPC・定期実行・Queueコンシューマー・Durable Objectをまとめ、
TanStack Startのweb・business・adminはそれぞれ独立したWorkerとして配備します。

アプリケーションの振る舞いはフレームワーク非依存のUseCaseクラスとして公開し、
APIのComposition Rootで依存関係を手動接続します。実装が1つのUseCaseには同じ操作を二重に宣言する
インターフェースを作らず、Composition Rootの戻り値にも実装クラスを使います。
Repository・外部サービス・コンテキスト境界の契約は維持します。

別コンテキストの集約を直接インポートせず、アプリケーションポート・ID・値のスナップショット・
ドメインイベントを通じて連携します。すべてのコンテキストやDDDレイヤーを別パッケージにはしません。
applicationの業務エラーはApplicationErrorで表し、通信形式への変換はpresentationが担います。

## 影響

- ドメインをフレームワークやCloudflareへ依存させず、高速に単体テストできます。
- 手動接続により依存が明示されますが、コンテキスト数に応じて接続の記述量が増えます。
- アプリの独立配備と、共通API内の業務連携を両立します。
- パッケージ公開入口と内部の依存規則を検証し、配置だけで境界を保証したことにはしません。
