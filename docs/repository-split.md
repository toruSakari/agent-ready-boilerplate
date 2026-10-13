# リポジトリの切り出し

この文書は現行サンプルのアプリを独立出力する手順です。別ドメインへの初期適用とは別の作業です。
出力にはルートのAGENTS・Skills・hooks・CI・独自lintを含めず、出力先のアプリに`pnpm check`があるとは限りません。
モノレポ用ハーネスをそのままコピーせず、独立先でのルール・参照先・検証方法は別途整備してください。

## 切り出す単位

apps/api・web・business・adminはそれぞれ独立したアプリです。
各画面のappとサービス固有のsrcは同じアプリとして切り出します。
複数サービスが実際に使う共有UI・クライアント・設定・API型契約はバージョン付きパッケージとして利用します。
商品管理はbusiness、全体の企業・ユーザー管理はadmin、通常会員登録はwebが所有します。
共有パッケージへ他サービスの機能を戻したり、他アプリのソースを一緒にコピーしたりしません。
配置の一覧は[ADR 017](adr/017-frontend-feature-ownership.md)を参照してください。
注文・商品などのDDD領域を別の業務サービスへ分割する構成ではありません。

## コマンド

ルートで依存をインストールし、変更を検証してから、新しいディレクトリへ書き出します。
API型を変えた場合はapi:typesを先に実行してください。

```sh
pnpm api:types
pnpm check
pnpm test
pnpm repository:export api --out ../api-repository
pnpm repository:export business --out ../business-repository
pnpm repository:export web --out ../web-repository
pnpm repository:export admin --out ../admin-repository
```

出力先が存在すると停止し、上書きしません。画面を出力すると型契約を再生成します。
APIは単独のbuild時にもdist/contracts/index.d.tsを生成します。
出力されたアプリには自分の設定とソース（app・srcを含む）、共有パッケージの.artifacts、pnpm設定が入ります。
フロントエンドの`*.stories.*`とルートのStorybook設定・fixtureは含めません。共有パッケージのtarballもstoriesを除外します。
通常の隣接テストと各画面の`vitest.config.ts`・`src/test/setup.ts`を保持し、独立先でも`pnpm test`を使えます。
画面の本番typecheckではテスト・テスト用setup・storiesを対象外にします。APIのテストも切り出し先に残します。
独立先のStorybook環境はこのexportでは提供しません。
Git履歴、.dev.vars、.env.local、DB・画像・DOのローカルデータはコピーしません。
公開したくない新規ファイルは.gitignoreへ追加し、出力内容をレビューしてください。

```sh
cd ../business-repository
corepack pnpm install
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

初回installで新しいpnpm-lock.yamlを生成し、そのリポジトリでコミットします。
以後のCIではinstall --frozen-lockfileを使います。Node・pnpmの指定も引き継ぎます。
APIと各画面、共有クライアントはそれぞれ自分の`pnpm test`を使えます。
画面のテストは`vp test --config vitest.config.ts`を実行し、アプリ内のsetup・エイリアス・jsdom環境で隣接テストを検証します。
ルートのテスト設定やStorybook fixtureを必要としません。全storyとアプリ間の契約はモノレポのルートで検証します。
独立typecheck・buildだけでテスト成功とは扱いません。
画面のE2Eは共通APIとの結合検証なので、分離後は検証対象のAPIを用意して全体テストを移設します。

## ライセンスの同梱

現在の`repository:export`は、ルートの`LICENSE`・`THIRD_PARTY_NOTICES.md`・`licenses/`を自動コピーしません。
再配布前にこれらを出力先へ同梱し、切り出し後の配置に合わせて第三者通知内のパスを確認してください。
生成済みの`worker-configuration.d.ts`や依存パッチに含まれる著作権・ライセンス表示も維持します。
`.artifacts`の共有パッケージを単体で配布する場合は、tarballの中にも必要なライセンスと第三者通知が含まれることを確認してください。
依存パッケージやビルド成果物の再配布には、それぞれのライセンス条件が適用されます。

## 共有依存の更新

最初は.artifactsのtarballをfile依存とpnpm overridesで固定します。
共有クライアントのUI・公開indexを追加した場合は`pnpm --filter @dev-template/client aliases:generate`で内部入口を更新します。pack時にも自動更新します。
アプリ固有の公開indexはそのアプリのsrc内で使い、clientのexportへ追加しません。
`#web/*`・`#business/*`・`#admin/*`は所有アプリだけで解決し、共有依存は`@dev-template/client`などの公開入口から使います。
共有パッケージを別のリポジトリで管理する場合は、package.jsonのversionを更新してpackまたはレジストリへ公開し、
消費側のバージョンとロックファイルを更新します。公開先・認証・アクセス権は運用環境に合わせて設定してください。
この変更でnpmやGitHub Packagesへの公開は行いません。

APIの型はURLから取得せず、サーバー側のpnpm api:typesで生成した@dev-template/api-typesを配布します。
入力・出力型は元のルーターと一致することをルートの型契約検証で確認します。
破壊的なAPI変更では旧クライアントとの互換性を維持する移行期間を設け、型パッケージとAPIを順序立てて更新します。
型の一致だけで配備済みの異なるバージョンの通信互換性が保証されるわけではありません。

## 配備と認証

リポジトリが異なっても同じCloudflareアカウントなら既存Worker名へのService Bindingを利用できます。
各リポジトリで配備用の権限・CI・Clerk・Cloudflare Accessを設定します。
運営画面とAPI両方のAccess検証、企業所属・権限のDB検証は維持してください。
本番のDB移行と既存在庫の切り替え手順は[Cloudflareセットアップ](cloudflare.md)に従います。

UI・クライアントはTS/TSXソースを配布するため、消費側のビルダーで変換できる必要があります。
このテンプレートはTanStack Start/Vite構成です。Next.jsへ移す場合はtranspilePackagesなどの設定を確認してください。

Repository BoundariesのCIは、4アプリを別ディレクトリへ切り出して依存をインストールし、
型チェック・隣接テスト・ビルドを4アプリすべての独立先で実行し、リポジトリ全体への依存が再び入ることを検知します。
