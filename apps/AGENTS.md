# アプリの作業ルール

DDD・FSD・公開境界・検証の規約は業務を問わず適用する。以下の具体的なサービス名・会員区分・
商品／注文／在庫・企業所属は現行サンプルの仕様で、新規業務の必須要件ではない。
別業務への初期適用は`docs/project-guide.md`の「別ドメインへの初期適用」に従う。
現行サンプルの操作を残す間は、その認可・tenant分離・整合性・ログ保護を維持する。

web・business・adminのappはルート・レイアウトと画面の接続を担う。
単一サービスが所有する業務UIは、そのアプリのsrcへ軽量FSDで置く。
複数サービスが実際に使う処理だけをpackages/clientへ置き、汎用UIプリミティブはpackages/uiを使う。
所有範囲はdocs/adr/017-frontend-feature-ownership.md、FSDの詳細はdocs/adr/003-lightweight-fsd.mdとdocs/project-guide.mdを参照する。

- appからsrcのwidgetを使い、widgets → features → entitiesの依存方向を守る。別スライスは公開index.tsから参照する。
- 現行サンプルではwebは一般購入者の商品探索・購入を中心にし、business・adminは役割別のダッシュボードと業務ページにする。一つのページへ一覧・登録・詳細・設定を集めず、目的ごとのURLへ分ける。概要の指標は全対象の集計を使い、一ページの件数を全体件数として表示しない。
  shadcn/uiと共有の意味別カラートークンを使い、ライト・ダーク・モバイルを確認する。実装していない決済・配送・レビューなどを動作する機能として表示しない。詳細はdocs/adr/028-commerce-storefront-and-dashboards.mdを参照する。
- webは`#web/*`、businessは`#business/*`、adminは`#admin/*`を自分のsrc内で使う。`#app/*`は自分のapp内の参照だけに使う。
  package.jsonのimportsは`"#サービス/*": "./src/*"`とし、`.ts`・`.tsx`・`/index.ts`をimport側に明示する。
  APIの`#api/*`と`#api-tooling/*`も同じ規約を使い、ファイルごとの例外や生成一覧は追加しない。
  他アプリの内部エイリアスやpackages/client/srcへの直接参照は禁止する。共有コードは@dev-template/clientの公開入口を使う。

- パス検証・翻訳・取得表示・エラー復旧・業務データの解釈は、`docs/project-guide.md`の
  「動的パスの検証」「多言語の表示とAPI契約」「取得の読み込み表示」「フロントのエラーと復旧範囲」
  「業務データの解釈と表示」の該当節を読み、共通規約に従う。
- API型は@dev-template/api-typesから導出する。クライアントからサーバーの実装や型を直接参照しない。
- 現行サンプルの商品・画像管理と企業メンバー画面はbusiness、全体の企業・ユーザー管理はadmin、通常会員登録はwebが所有する。
  似た画面や将来の再利用だけを理由に、サービス固有の操作を共有パッケージへ戻さない。
- フォームはReact Hook Form・Zod、送信とキャッシュ更新はtRPC・TanStack Queryを使う。
  shadcn/uiのForm・Label・Alertなどは@dev-template/uiから利用し、共通のセマンティック色とアクセシビリティを保つ。
- storyと単体テストは対象の実装と同じ階層に置き、移動時も一緒に移す。#storybook/fixturesはstory専用で、本番コードでは使わない。

APIルートは共通サーバーへのService Bindingプロキシだけにする。秘密情報をクライアントに渡さない。
本人確認とサービス資格は各appのpathless routeのbeforeLoadで照会し、root Providersに公開パス判定を置かない。
遷移先の企業IDとサービスを明示し、既存APIで検証する。layoutは表示の組み立てと認証・資格のリアルタイム監視を担当する。
layoutの表示ガード、ProxyのCookie同期、キャッシュ制御、API側の現在権限検査は別の責務として維持する。
ページ入口・認証を変更する場合はdocs/adr/019-frontend-request-authentication.mdを参照する。
apiはsrcにDDDの4レイヤーを持ち、Worker設定・Drizzle・seed・API用運用スクリプトも同じアプリ配下に置く。
各アプリを独立してビルド・配備し、運営と事業者の認可をAPIでも検証する。

- `app/routes`はURLのセグメントごとにフォルダーを分け、ページのルート宣言は`route.ts`、子を包むガードは`layout.ts`へ置く。共有のStart設定は`indexToken: "route"`・`routeToken: "layout"`を使う。`__root.ts`は公式の必須名を維持する。
  ページの表示接続は同じディレクトリの`-page.tsx`、ガードの表示接続は`-layout.tsx`へコロケーションする。ページ専用の補助ファイルも`-`で始め、Routerにルートとして探索させない。複数ルートで共有するログイン表示はsign-inディレクトリが所有する。
  `(web)`等のgroupと`_authenticated`・`_qualified`はURLへ出ない。動的セグメントは`$organizationId`、splatは`$`ディレクトリで表す。フラットなドット区切りのルート名へ戻さない。業務ロジックはFSDに残し、Startのserver functionへ共通APIを複製しない。
- `routeTree.gen.ts`はRouterの自動生成物で、直接編集しない。リンクは`to`・`params`を使い、企業IDを手動で二重復号しない。詳細はADR 024を参照する。

- 各appの`app/start.ts`は共通のrequest/functionログmiddlewareを登録する。Start設定を独自に定義すると既定CSRF middlewareは追加されないため、server functionに対する`createCsrfMiddleware`も明示する。
  Worker入口の共通ログ処理はStart前のAPIプロキシ・認証応答も計測する。URL・本文・Cookie・送信データ・生の例外をログへ渡さない。要求IDはサーバー生成の要求単位ストアで共有し、利用者指定のIDは採用しない。
