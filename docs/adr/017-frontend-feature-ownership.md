# ADR 017: サービス固有のフロントエンド機能を所有アプリへ置く

## ステータス

採用。[ADR 003](003-lightweight-fsd.md)の軽量FSD、[ADR 010](010-multi-app-organization-access.md)の3画面・共通API、
[ADR 011](011-repository-boundaries.md)の公開パッケージ境界に従い、サービス固有の業務UIを所有アプリへ置く。

## 背景

各サービスのルートが独立していても、商品管理・運営の全体管理・通常会員登録まで共有クライアントに置くと、
その機能を変更する責任と利用するアプリがコードの配置から分からない。
共通コンソールへサービス分岐を集めると、運営専用の取得・更新も他サービスが利用する公開入口へ混ざる。
別リポジトリへの切り出しでも、自分のアプリの業務UIを共有パッケージの変更として扱う必要が生じる。

一方、所属・ロール管理はbusinessとadminが実際に同じ部品を利用している。
注文は購入・本人注文をweb、受注管理をbusinessが所有する。共有パッケージに残る注文スライスの現在の利用範囲は、下表で区別する。
これらや認証・通信基盤をすべて複製すると、同じ契約や不具合修正を複数箇所で維持することになる。
サーバー側の会員モデル分離だけでは、このフロントエンドの所有範囲は決まらない。

## 決定

### 所有サービスを先に決め、各所有元で軽量FSDを使う

以下の所有一覧は現在のcommerceサンプルです。新規業務でも所有元の決定原則を再利用し、具体的なactor・操作・画面は要件から決めます。

単一サービスの機能は`apps/<サービス>/src`へ置く。`app`はルート・レイアウトとwidgetの接続を担う。
複数サービスが実際に同じ責務を使う処理は`packages/client/src`、汎用UIプリミティブは`packages/ui`へ置く。
FSDのentities・features・widgetsは責務の区別であり、それ自体を共有の根拠にしない。

| 所有元                                    | スライス・機能                                                                                                                                                                            | 利用サービスと理由                                                                                                                           |
| ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `apps/business/src`                       | `entities/product`、`features/create-product`、`features/manage-product-image`、`widgets/product-admin`                                                                                   | 商品型・取得・画像表示・登録・画像編集・商品管理画面はbusinessだけが使う                                                                     |
| `apps/business/src`                       | `widgets/business-members`、`entities/order`、`features/manage-stock`、`widgets/business-orders`、`widgets/inventory-admin`                                                               | 企業のメンバー・受注・在庫画面はbusinessが所有し、必要な共有部品を組み立てる                                                                 |
| `apps/admin/src`                          | `entities/directory`、`features/manage-organizations`、`features/manage-users`、`widgets/admin-console`                                                                                   | 全体の企業・ユーザー一覧、企業作成・停止、ユーザー管理と運営画面はadminだけが使う                                                            |
| `apps/web/src`                            | `entities/store-product`、`entities/cart`、`entities/customer-order`、`features/checkout`、`features/cancel-order`、`features/register-customer`、`features/change-plan`、対応するwidgets | 公開ストア・カート・購入・本人注文・登録・個人プランはwebが所有する                                                                          |
| business（現配置は`packages/client/src`） | `entities/order`、`features/manage-order`                                                                                                                                                 | 本番アプリの利用者はbusinessだけ。受注の表示・操作をbusinessが所有し、複数アプリの共有機能とは扱わない                                       |
| 旧スライス（`packages/client/src`）       | `features/place-order`、`widgets/order-dashboard`                                                                                                                                         | 現在の本番アプリからの利用はない。テスト・storiesや旧スライス内の参照は実アプリの共有根拠にせず、新しい購入・本人注文の機能はweb側に追加する |
| `packages/client/src`                     | `entities/access`、`features/manage-access`、`widgets/access-console`の共有部分                                                                                                           | businessとadminが所属・ロール管理を共有する。会員・セッション確認、企業選択、招待承諾や共通レイアウトも実際の利用範囲に応じて残す            |
| `packages/client/src`                     | `features/manage-service-account`、`widgets/service-account`、`features/switch-theme`、`_app`、`shared`                                                                                   | 3画面で使う本人退会、テーマ、認証・通信・プロバイダーを共有する。通常会員登録は含めない                                                      |
| `packages/ui`                             | Button・Form・Alertなどのプリミティブとセマンティック色                                                                                                                                   | 業務ルールを持たない共通UIとして各所有元から使う                                                                                             |

注文の共有パッケージ残置は現在の配置の記録であり、新規実装をそこへ集める方針ではない。
購入・本人注文はweb、受注はbusinessを変更元とする。旧スライスの移動・削除は利用確認を伴う別の変更として扱う。

運営専用のdirectory型・一覧クエリ・企業更新・ユーザー削除はadminが所有する。
共有の所属・ロール管理からこれらの運営専用操作を切り離し、共通コンソールにサービス固有の画面を残さない。
商品画像の容量・形式、商品登録の入力スキーマもbusinessのスライスと一緒に置く。
API入出力型は引き続き`@dev-template/api-types`から導出する。

### 共有の機構へ渡すアプリの方針を呼び出し側で示す

共有パッケージ内の`shared`と、複数アプリが使う`packages/client`は同じ意味ではない。
共通の業務表現はentities・features・widgetsへ置き、単一アプリの導線やルート構成を共有側の種別分岐で隠さない。

- 各アプリが`AppProviders`へ対象の`service`を明示する。web・businessの`src/_app/providers`が
  自分の企業ルートから`organizationId`を解決し、adminは企業scopeを付けず`operator`を渡す。
  共有の通信層にアプリ名とサービスの対応表やpathname解析を置かない。サービス未指定の利用は拒否する。
- 共通Providerは本人・service・organizationIdに結び付いたQueryClientと通信ヘッダーを管理する。
  同じ企業内の画面遷移では保持し、本人・サービス・企業の変更では破棄する。遅れて取得したtokenで
  新しい企業のヘッダーを使わない。ルートの`OrganizationScope`は表示側へ企業IDを渡す役割として残す。
- 顧客登録の`/register`と`CustomerRegistrationPrompt`はwebの`widgets/customer-registration`が所有する。
  webの資格layoutと`/account`が`missingRegistrationContent`で共通ガード・会員widgetへ渡す。
  共通の登録状態確認・未登録表示・企業／運営の招待案内は共有に残し、顧客登録への導線を自動で足さない。
- 商品・メンバー画面へのリンクと権限条件はbusinessの`widgets/business-navigation`が所有する。
  `BusinessShell`がこれを表示し、businessのルートは権限不足画面にも`navigation`として渡す。
  business専用のURL・権限条件を共有widgetへ重複させず、実際に利用する画面の所有元で接続する。

表示枠や明示した値を受け取る小さな公開APIで接続する。画面ごとの差分を集める設定レジストリや
汎用管理フレームワークは追加しない。これらの表示と通信scopeはAPI側の現在権限検査を代替しない。

### 参照は所有元の内部入口と公開パッケージ入口を区別する

- 共通クライアント内は`#client/*`、web内は`#web/*`、business内は`#business/*`、admin内は`#admin/*`を使う
- 各アプリの`#app/*`は自分のルート・レイアウト用に使う
- 各サービスのimportsは`"#サービス/*": "./src/*"`へ統一し、importに`.ts`・`.tsx`を明示する
- 同じ所有元の別スライスは`#business/entities/product/index.ts`のように公開`index.ts`を明示して参照する
- アプリから共有クライアントは`@dev-template/client`の公開subpath、汎用UIは`@dev-template/ui`の公開入口から参照する
- 他アプリの内部エイリアス、共有パッケージの非公開ソース、共有パッケージからアプリへの参照は禁止する
- widgets → features → entitiesの依存方向を各所有元で守り、entitiesが操作featureを必要とするときはchildrenなどで受け取る

公開クライアント入口からアプリ固有の機能を再公開しない。
同じworkspaceだから参照できる構成にせず、独立アプリでも同じimportで解決する。

### Storyとテストも所有する実装に置く

storyと単体テストは対象実装と同じ階層に置き、所有元の移動時に一緒に移す。
ルートのStorybookは共有パッケージと3アプリのsrcからstoriesを収集する。
`.storybook/fixtures.tsx`は表示テスト用のprovider・架空応答を組み立てるルートの補助とする。
`#storybook/fixtures`はstoryとルートの検証だけで利用し、本番コードの参照は拒否する。
実APIやClerkには接続せず、未定義のfixtureは失敗させる。

各アプリの本番CSSは自分のapp・srcを探索する。共有CSSは共有パッケージの範囲だけを探索する。
本番のCSS探索からstoriesを除き、Storybookのpreviewでだけstoriesを追加する。
共有パッケージのtarballとimportマップにもstoriesを含めない。

### 独立リポジトリの出力

`repository:export`は対象アプリのapp・src・設定を持ち出し、共有依存は既存のtarballへ固定する。
フロントエンドの`*.stories.*`とルートのStorybook環境は出力しない。
通常の隣接テストを保持し、各画面は自分の`vitest.config.ts`と`src/test/setup.ts`で実行する。
独立先でも`pnpm test`でアプリ固有のテストを実行でき、ルートのテスト設定・fixtureには依存しない。
画面の本番typecheckではテスト・テスト用setup・storiesを除外する。APIのテストも維持する。
独立したStorybookの提供は、このexportの範囲に含めない。

モノレポの全体検証と4アプリの独立install・typecheck・test・buildを分けて確認する。
移動先のsrcを独立ビルドから漏らしたり、ルートエイリアスで依存を隠したりしない。

## 選択肢

- すべての業務UIをpackages/clientへ残す：所有サービスが不明確になり、単独の変更にも共有パッケージ更新が必要になるため不採用
- 共有コードもすべてアプリへ複製する：実際に共有する所属・認証処理まで重複保守になるため不採用
- サービス種別や設定オブジェクトを渡す汎用管理featureへ統合する：異なる操作と変更責任を名前や分岐で隠すだけの抽象化になるため不採用
- 所有アプリのFSDへ移し、実際の共有だけを公開パッケージに残す：採用
- すべてのfeatureを個別workspaceにする：独立した利用者・公開周期がない段階ではパッケージ管理が増えるため不採用

## 影響と検証方針

サービス固有機能を同じアプリ内で変更でき、共有パッケージの公開範囲が小さくなる。
その代わり、各アプリにsrcのエイリアス・依存・型チェック・CSS探索を設定し、ルートの検証対象へ含める必要がある。
二つ目のサービスが同じ機能を使う時点で責務と差分を比較し、必要な部分だけを共有へ移す。
将来の共有を予測した空の層・汎用インターフェース・新パッケージは追加しない。

ルートの境界チェックで他アプリ参照・非公開参照・本番からのStorybook参照を拒否する。
単体テスト・portable stories・Storybookビルド・アプリビルドと、各アプリの独立exportを検証する。
商品管理、運営管理、通常会員登録、businessが使う注文部品と共有の招待・所属・退会の既存の動作と拒否条件を維持する。
[検証ガイド](../project/verification.md)に従い、実行した項目と未実行・失敗・環境制約を区別して完了報告またはPRへ記録する。
