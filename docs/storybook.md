# Storybook

## 起動と対象

Node・pnpmはリポジトリ指定の版を使い、`pnpm install --frozen-lockfile`後に実行します。

```sh
pnpm storybook
pnpm build-storybook
pnpm test:stories
```

開発URLはhttp://127.0.0.1:6006、静的出力は`storybook-static/`です。
生成物はGit管理しません。静的ビルドはローカルファイルを生成するだけで、自動公開はしません。

対象は`packages/ui/src`の共通UI、`packages/client/src`の共有FSD、
`apps/web/src`・`apps/business/src`・`apps/admin/src`のサービス固有の表示部品です。
Storyを集める専用フォルダーは作らず、必ず対象ファイルの隣に置きます。実装の所有元が変わるときはstoryと単体テストも一緒に移します。

```text
packages/ui/src/button.tsx
packages/ui/src/button.stories.tsx
packages/client/src/features/place-order/ui/order-form.tsx
packages/client/src/features/place-order/ui/order-form.stories.tsx
apps/business/src/widgets/product-admin/ui/product-admin.tsx
apps/business/src/widgets/product-admin/ui/product-admin.stories.tsx
```

shadcn/uiを除く表示コンポーネントは、子コンポーネントも含めて自身の隣接StoryとMetaを持ちます。
本番コードは一ファイル一コンポーネントとし、複数の部品のStoryを一つのファイルへまとめません。
shadcn/uiの既存Storyは維持しますが、全プリミティブへのStory追加は必須にしません。
URLを接続するだけのapp/page・layout、通信・認証プロバイダー、hookには表示目的だけのstoryを作りません。
それらの処理は既存の単体・結合・E2Eテストが担当します。

ツールバーのlocaleで日本語・英語を比較できます。Storybookは表示全体を管理するCSRのため、再読み込みなしで言語を設定します。
本番のCookie切替とSSRはE2Eで検証します。APIエラーのfixtureは公開errorCode/errorReasonを指定し、本文を表示に使いません。

## Storyの書き方

CSF3の`Meta`・`StoryObj`を`@storybook/react-vite`から読み込みます。
実コンポーネントを使い、既定・空・処理中・失敗・無効・権限制限など、その部品に意味のある状態を追加します。
型付きの架空データは対象のstoryに置き、サーバー実装や実ユーザー情報を読み込みません。
同じ所有元の別スライスは公開index、共有クライアントと共通UIは公開パッケージ入口を通します。
`#web/*`・`#business/*`・`#admin/*`は自分のアプリだけで使い、`#client/*`はclient内だけで使います。
相対importや他アプリの内部参照は使いません。

クリックや入力の確認は`storybook/test`の`expect`・`userEvent`・`within`を使う`play`へ書きます。
処理待ちは要素の出現・状態の変化を待ち、固定時間のsleepにしません。

## 通信・認証を分離する

ルートの`.storybook/fixtures.tsx`がテスト専用のproviderと架空のRPC応答を持ちます。
`.storybook/preview.tsx`とportable storiesのテストが、それを使って各storyごとにQueryClient・tRPC・サービス区分・認証状態を作り直します。
Storyからfixtureの型や補助を使う場合は`#storybook/fixtures`を参照します。この入口は本番コードでは禁止です。
複数アプリの表示検証を組み立てるためのルート側の処理であり、共有クライアントの公開機能にはしません。
ClerkProviderやアプリのAppProvidersは起動しません。
`tRPC`はHTTPリンクを持たず、`parameters.fixtures`の応答だけを返します。
未定義の応答はローカルエラーになり、実APIへフォールバックしません。

```ts
parameters: {
  fixtures: {
    mode: "business",
    organizationId: "story-organization",
    authentication: "signed-in",
    queries: { "product.list": { data: [] } },
    mutations: { "product.create": { error: "登録に失敗しました" } },
    image: "ready",
    imageMutation: {},
  },
}
```

各RPC応答は`{ data }`・`{ error: "文言" }`・`{ pending: true }`で指定します。
必要な応答は各storyで明示します。`image`は`ready`・`error`・`pending`です。
商品画像も同じtRPC fixtureで応答し、`product.getImage`の型に合うPNGのbase64・contentType・etagを返します。
画像表示は本番と同じBlob復元とobject URLの経路を使います。
`imageMutation`を指定した場合だけ架空の書き込みを許可し、未指定ではエラーにします。
画像のアップロード・削除も、実サービスへ送信しません。
公式TanStack Routerをmemory historyで動かし、実際のCatchBoundaryとLinkを使用します。アプリのルートやserver functionは起動せず、通信はtRPC fixture内に閉じます。

単一企業からの自動遷移など、実URLへ移動する状態はstoryに持ち込まず、既存E2Eで扱います。
招待リンクのstoryは無効・未指定状態を扱い、実トークンや本来のsessionStorageを使いません。

## テーマとCSS

既存UIとクライアントのCSSを1つのpreview CSSから読み込み、共通トークンを使います。
アプリのsrcと全所有元のstoriesもpreviewで探索し、移動した画面のクラスを生成します。
本番は各アプリのapp・srcをそのアプリのCSSから探索し、共有CSSから他アプリを探索しません。
ツールバーでlight・dark・systemを選べます。ThemeMenuも操作できます。
保存キーはStorybook専用で、アプリのテーマ設定を変更しません。
StorybookにはCloudflare・TanStack Startの起動設定やアプリの環境変数を読み込ませません。

## パッケージ境界と検証

Storybookの実行設定とfixtureはルートに置きます。共有パッケージのstoriesは配布tarballと
clientのimportマップ生成から除外します。テスト用providerを共有パッケージへ公開しません。
`repository:export`もアプリの`*.stories.*`を除外し、ルートのStorybook環境はコピーしません。
通常の隣接テストはアプリ内のVitest設定とsetupも保持し、独立先の`pnpm test`で実行できます。
画面の本番typecheckではテスト・テスト用setup・storiesを対象外にします。
モノレポのStorybookで全所有元を検証する構成であり、切り出し先のStorybook環境は別途必要です。
通常のアプリビルドにStorybookを混ぜません。
通常のCSS探索からもstoriesを除外し、preview CSSの末尾でのみ再び探索対象に加えます。
ルートの型チェックはstoriesとStorybook設定も対象です。

`pnpm test:stories`は全storyをportable storiesとして描画し、playを実行します。
各アプリ・共有clientの`ui`配下で、再公開だけの入口とInvitationProviderを除く
表示コンポーネントに隣接Storyがあることも検査します。
実ネットワーク呼び出しは失敗させます。これはjsdomの相互作用テストであり、
実ブラウザーのレイアウト・見た目・色の確認の代わりにはなりません。
ブラウザーで確認する場合は`pnpm storybook`を開き、狭い画面と両テーマ、フォーカス、エラー表示を確認します。

変更後は`pnpm check`・`pnpm typecheck`・`pnpm test`・`pnpm build`・`pnpm build-storybook`を実行します。
切り出しへの影響がある場合は4アプリの`repository:export`・独立install・typecheck・test・buildも確認します。

公式資料: [React/Vite](https://storybook.js.org/docs/get-started/frameworks/react-vite)、
[portable stories](https://storybook.js.org/docs/api/portable-stories/portable-stories-vitest)。

## 静的ビルドの制約

Storybook 10.6.1のpreview iframeには、操作テスト・コード表示で使う
Testing Library、aria-query、acorn、escodegenなどのランタイムがまとまり、
Viteの500 kB超過警告が残ります。静的ビルドとStoryの描画・操作は成功しますが、
Storybook初回表示の転送量に影響します。本番アプリのビルドへは含めません。
解消にはStorybook側のランタイム分割・依存構成の改善が必要です。警告の閾値は変更しません。
Start・Cloudflareの構成は[ADR 024](adr/024-tanstack-start-frontend.md)、環境の制約は[ADR 022](adr/022-business-ip-restriction.md#検証環境の制約)を参照してください。
