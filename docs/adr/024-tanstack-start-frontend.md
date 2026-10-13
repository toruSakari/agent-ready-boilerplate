# ADR 024: TanStack StartとFSDの接続

## ステータス

採用。顧客・企業・管理画面をTanStack Startで構築し、Cloudflare Workerとして独立配備する。
Hono＋tRPCの共通API、サーバーのDDD、サービス会員の独立性、APIでの毎回の認可は維持する。

## 背景・理由

3画面は共通APIからデータを取得するReactアプリで、URL・認証ガードとFSDの業務UIを分けて管理する。
TanStack Routerの型付きリンクとpathless layoutで接続を明示し、StartのSSRとCloudflare Vite pluginでWorkerへ配備する。
各アプリが自分のルート型を所有するため、共有clientはサービス固有のルート登録へ依存しない。

## 決定

各アプリの`app/`はStartの起動・URLと画面の接続を所有し、`src/`は軽量FSDを所有する。
`app/routes/`はURLのセグメントに対応するディレクトリ構成にする。ページのルート宣言は`route.ts`、子を包むガードは`layout.ts`、表示をwidgetへ接続するコンポーネントは同じディレクトリの`-page.tsx`・`-layout.tsx`に置く。複数段のログインはsign-inディレクトリの表示を共有する。業務UI・入力判断・取得処理はFSDに残し、ルートのディレクトリへ移さない。
`-`始まりのファイルはRouterの探索対象外で、業務判断や取得処理は持たせない。

```text
apps/web/
  app/
    start.ts                               # 共通ログmiddlewareと明示的なCSRF保護
    router.ts                              # 要求ごとにRouterを作る
    root-document.tsx                      # HTML・HeadContent・Scripts・nonce
    root-layout.tsx                        # ProviderとOutlet
    routes/
      __root.ts                            # 公式の必須名
      (web)/                               # URLへ出ないサービスgroup
        sign-in/
          route.ts                         # /sign-in
          -page.tsx                        # ログイン表示の接続
          $/route.ts                       # /sign-in/*、同じ表示を共有
        invitations/accept/
          route.ts                         # /invitations/accept
          -page.tsx
        register/
          route.ts                         # /register
          -page.tsx
        _authenticated/
          layout.ts                        # 本人確認beforeLoad
          -layout.tsx                      # AuthenticationGateとOutlet
          account/
            route.ts                       # /account
            -page.tsx
          _qualified/
            layout.ts                      # 顧客資格beforeLoad
            -layout.tsx                    # 資格のリアルタイム監視
            route.ts                       # /
            -page.tsx
            organizations/$organizationId/
              route.ts                     # /organizations/:organizationId
              -page.tsx                    # widgetと表示ガードの接続
    routeTree.gen.ts                       # 自動生成、直接編集しない
  src/                                     # _app・widgets・features・entities・shared
  worker-entry.ts                           # API転送・Cookie同期・CSP・Start
```

business・adminも同じ本人確認の階層を使い、資格ガードへbusiness・operatorを明示する。
`(web)`・`(business)`・`(admin)`はURLへ出ないgroupで、モノレポのファイルルート型のID衝突を避ける。
`/account`は資格ガードの外に置き、未登録・資格喪失後も本人が登録確認・退会を行える。
[公式のファイルルーティング設定](https://tanstack.com/router/latest/docs/api/file-based-routing)に従い、共有のStart設定は`indexToken: "route"`・`routeToken: "layout"`を使う。`route.ts`はそのフォルダーのindexページなので、企業フォルダーに注文ページとproducts・membersの子フォルダーを併置しても、注文画面が子を覆わない。businessの商品は`organizations/$organizationId/products/route.ts`、メンバーは`organizations/$organizationId/members/route.ts`へ置く。URLは従来のまま維持する。

[公式の命名規約](https://tanstack.com/router/latest/docs/framework/react/routing/file-naming-conventions)に従い、`__root.ts`だけはルートディレクトリに置く。`$organizationId`・`$`は動的セグメントとsplat、`_authenticated`・`_qualified`はURLへ出ないpathless layoutにする。ページ専用ファイル・フォルダーは`-`で始めて探索対象外にし、フラットなドット区切りのファイル名は使わない。

画面のリンクはRouterの`to`と`params`で組み立てる。企業IDのエンコードはRouterへ委ねる。
rootのProviderは現在のmatchから復号済み企業IDを受け取り、再度decodeURIComponentを使わない。
企業が変われば既存の本人・サービス・企業ごとのキャッシュ分離と保留要求の破棄を行う。

API応答の解釈はentities/model、操作の入力検証はfeatures/model、ページの組み合わせはwidgetsに置く。
ルートへ業務処理を移さず、Startのserver functionへHono＋tRPCのAPIを複製しない。
loaderを追加するときはentitiesのクエリ定義を再利用し、要求ごとのQueryClientと認証情報で取得する。
現在の業務データは引き続きブラウザーの認証付きtRPCで取得する。
本人確認・資格のbeforeLoadは、アプリごとに固定したサービスのStart server functionから既存APIを照会する。
直接アクセスとクライアント遷移の両方で実行し、遷移先の企業IDを使う。
/accountは本人確認のみ、公開ログイン・登録・招待は照会の外とする。
未ログイン・未登録の遷移先と拒否・障害時の表示はADR 019に従う。
layoutのAuthenticationGateとServiceQualificationGateは読み込み待ち・ログアウト・資格喪失の監視を維持する。

## 認証・セキュリティ

Workerの`withSecurityHeaders`で外部指定nonceを上書きし、Cookie同期とStartの処理を包む。
`src/_app/server/proxy.ts`はClerkの同期だけを担い、ページ遷移の利用条件はpathless routeのbeforeLoadが確認する。
同期の継続判断は内部ヘッダーを持つResponseで表し、Workerが消費する。ブラウザーへ内部ヘッダーを返さない。
SDKの複数Set-Cookie、許可origin・issuer・azp・セッション状態、外部Locationの制限を維持する。

`/api`は既存のService Bindingプロキシへ直接渡し、APIが毎回認証・認可する。
招待入口はCookie同期の外部転送より先にfragmentを回収する。InvitationProviderが回収・URL消去を済ませるまで
Clerkと業務UIを初期化しない。サーバー描画でもこの準備表示が子の業務データ取得を止める。

Startのサーバー側Routerは要求ヘッダーからnonceを読み、`ssr.nonce`へ渡す。
RootDocumentのnonce付きmetaはクライアントへの引き継ぎに使う。
Startのストリーミング・初期化スクリプト、Clerk、テーマ初期化に同じnonceを使い、HTMLはprivate, no-storeとする。

既存の`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`・サービスoriginの設定名は維持する。
ビルドへ渡す公開値は3項目に限定し、CLERK_SECRET_KEYなどの秘密はWorker環境だけから読む。
未設定・空の公開値はundefinedとして扱い、ローカルの招待先originの既定値を有効にする。
DataProvidersは受け取った企業IDを表示用Contextと通信ヘッダーの両方へ渡し、企業変更時にはキャッシュを分離する。

## 配備・検証

Cloudflare Vite pluginのSSR環境を使い、`dist/client`と`dist/server/wrangler.json`を生成する。
配備はWranglerで行う。Previewも生成設定からPR専用API Bindingを設定する。
各アプリと共有依存は引き続き独立リポジトリへ切り出せる。

生成したrouteTreeはRouterの標準生成物としてlint・formatterから除外する。
手書きのルート・接続・FSD・テストは既存のチェックを維持する。
Storybookは実APIと独立したmemory Routerを使い、公式のCatchBoundaryとLinkをそのまま検証する。単体テストも実Routerのコンテキストで検証する。
直接アクセス、企業切替、招待、サービス別登録・退会、テーマ、商品画像、注文、IP制限のE2Eを維持する。

公式資料: [Start](https://tanstack.com/start/latest/docs/framework/react/overview)、
[Cloudflare](https://tanstack.com/start/latest/docs/framework/react/hosting#cloudflare-workers)、
[ルーティング](https://tanstack.com/router/latest/docs/framework/react/guide/file-based-routing)。

RouterのRegisterはアプリごとの型登録なので、`pnpm typecheck`で各アプリを独立したTypeScript programとして検査する。
ルートの共通検証はFSD・Story・テストを検査し、各アプリのRouter起動・ファイルルートの型登録と、Routeを参照する`-page.tsx`などの接続は各アプリの検査が担当する。
ルートの共通検証は`app/routes`の`.ts`・`.tsx`をともに除外し、型登録のないprogramへ接続だけを混在させない。
`tests/frontend-typecheck-boundaries.test.ts`で全ルートファイルが所有アプリの型検査に含まれることと、
集約コマンドが3アプリの検査を実行することを確認する。
共有clientのLinkと一覧検索hookはAnyRouterを明示し、所有アプリのルート型へ依存しない。
一覧検索hookは利用側から渡されたZod schemaでURLの読み取りと更新をともに検証し、注文状態と企業状態を混同しない。サービス固有のLinkはそのアプリの型登録で検査する。

ローカルの画面・API結合はデモ認証で検証する。実Clerk鍵によるログインと本番Cloudflareへの配備は実環境で確認する。
Storybook 10.6.1とVite+ 0.3.3のpeer不一致、Drizzle Kit・Vite+配下の非推奨依存は上流の更新を必要とする。
Storybookのpreview chunkサイズ通知と実行環境のプロキシ検出通知は抑制しない。

保護ルートの照会クライアントは必要になったときに読み込み、エラー表示は同期importで即座に描画する。
ブラウザーではReact・Clerk・Query・フォームのvendorを分け、初期chunkへの集中を避けて個別にキャッシュする。
この分割はclient環境だけへ適用し、Workerのサーバービルド設定と警告の上限は変更しない。

## パスパラメーターの検証

Startの[公式ルーティングガイド](https://tanstack.com/start/latest/docs/framework/react/guide/routing)に従い、パスの扱いはTanStack Routerへ委ねる。[Path Paramsガイド](https://tanstack.com/router/latest/docs/framework/react/guide/path-params)と[RouteOptionsのparams.parse](https://tanstack.com/router/latest/docs/framework/react/api/router/RouteOptionsType#paramsparse-method)を参照する。旧`parseParams`は非推奨のため使わない。

`params.parse`にはZodの`parse`を呼ぶ関数を渡し、失敗時は例外を投げてルートのエラー状態にする。`validateSearch`はクエリパラメーター用なのでパス検証には使わない。パス検証は複数回評価され得るため、同じ入力に同じ結果を返し、通信・キャッシュ更新などの副作用を持たせない。現在は文字列を検証するだけで型・値を変換しないため、`params.stringify`による独自変換は追加しない。数値などへ変換する場合はURL生成時の文字列化も合わせて定義する。

企業IDを持つ全ルートとログインのsplatには`params.parse`を設定し、共通のZodスキーマで検証する。企業IDはAPIと同じ200文字上限を契約テストで照合し、空値・前後の空白・制御文字を拒否する。ログインのsplatはSDKの複数段パスを維持し、同じ文字制約と専用の長さ上限を適用する。未知の通常パスはRouterの404で扱う。

Routerが復号した値はそのまま検証し、trimや二重復号で別の識別子へ変換しない。符号化されたスラッシュ・パーセントを含む既存の識別子は維持する。子ルートのparse失敗でも親のbeforeLoadは走るため、本人確認・資格照会の前にも同じスキーマを使う。不正な企業パスでは照会自体を開始しない。Startのserver functionへ直接入力された企業IDもvalidatorで拒否し、共通APIの認証・入力検証・認可を維持する。失敗は最寄りのError Boundaryで内部文言を公開せず表示する。

## ログの接続

`app/start.ts`に公式のcreateStartを置き、requestMiddlewareでStartの要求、functionMiddlewareで
SSRを含むserver functionの呼び出しを計測する。Worker入口はAPIプロキシ・Clerkの早期応答も扱う。
共通loggerは出力・マスキングを所有し、各機能が固定イベント・日本語文言・許可項目を宣言する。
サーバーの要求ストアは.server処理から読み込み、ブラウザへ持ち込まない。
独自のStart設定では自動CSRF処理が追加されないため、server function用のcreateCsrfMiddlewareを明示する。
詳細は[ADR 023](023-security-boundaries-and-resource-limits.md)を参照する。
