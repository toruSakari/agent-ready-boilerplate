# agent-ready-boilerplate

Cloudflare向けのTypeScriptテンプレートです。一般ユーザー・事業者・運営の画面を独立して配備し、
共通のHono＋tRPC APIとD1を使います。サーバーはDDDのモジュラーモノリス、クライアントは軽量FSDです。
フロントの取得・描画エラーはError Boundaryで扱い、独立して復旧できる領域へ配置します。方針は[ADR 025](docs/adr/025-frontend-error-boundaries.md)を参照してください。

## 構成

```text
apps/
  api/                 # 共通Hono Worker（ローカル8787）
    src/
      domain/          # Entity・Value Object・Repository契約
      application/     # UseCaseクラス・認可・外部依存ポート
      infrastructure/  # D1・Clerk・R2・DO・Queueアダプター
      presentation/    # Hono・tRPC・公開エラーコード変換
      composition-root.ts
    worker-entry.ts    # fetch・scheduled・queue・DO
    wrangler.jsonc
    drizzle.config.ts
    drizzle/           # 生成SQLとマイグレーション履歴
    tooling/           # API固有の運用コマンド
      seeds/           # 固定fixtureとDrizzleによる投入
  web/                 # 一般ユーザー向けTanStack Startアプリ（5173）
    app/               # ルート・レイアウト
    src/               # 商品検索・カート・購入・注文履歴のFSD
  business/            # 事業者向けTanStack Startアプリ（5174）
    app/               # ルート・レイアウト
    src/               # 企業ダッシュボード・注文・商品・メンバー管理のFSD
  admin/               # 運営向けTanStack Startアプリ（5175）
    app/               # ルート・レイアウト
    src/               # 運営ダッシュボード・企業・ユーザー・権限管理のFSD
packages/
  client/src/          # 複数サービスで使う_app・widgets・features・entities・shared
  ui/                  # shadcn/ui・ライト／ダーク／システムテーマ
  api-types/           # tRPCから導出する型だけの契約
  config/              # 各画面の共通ビルド設定
tests/                # アプリ間の契約検証と共通テスト設定
```

Order・Inventory・Payment・Product・Accessのサンプルを含みます。
業務コードをDDDレイヤーごとにパッケージ化せず、実際の配備・共有の境界をワークスペースにします。
フロントエンドの単一サービス機能は所有アプリのsrcに置き、注文（web・business）、所属・ロール管理（business・admin）、
招待・退会・テーマ・プロバイダー（3画面）など実際に共有する処理をpackages/clientに残します。
アプリ間のソース直接参照はせず、共有処理は@dev-template/clientの公開入口から使います。
[機能の所有範囲と配置](docs/adr/017-frontend-feature-ownership.md)を参照してください。
[構成と認可の判断](docs/adr/010-multi-app-organization-access.md)、
[開発ガイド](docs/project-guide.md)、[Cloudflareの配備手順](docs/cloudflare.md)を参照してください。
[TanStack Startのルート・FSD・認証の接続](docs/adr/024-tanstack-start-frontend.md)を参照してください。

画面はi18nextで日本語・英語に対応します。ストアのヘッダーまたは各管理画面の言語選択でCookieを更新し、同じ言語でSSRし直します。
翻訳は`packages/client/src/shared/i18n/en.ts`で管理します。[多言語対応の方針](docs/adr/026-internationalization.md)を参照してください。

## CIと配備の範囲

GitHub Actionsはテスト・型チェック・lint・build・E2E・アプリ境界の検証だけを行います。
本番配備、PRプレビュー配備、プレビュー削除のワークフローは含みません。pushやPR操作では配備しません。
Wrangler設定と手動の運用コマンドは雛形として残しています。実環境へ接続する前に、対象アカウント・
リソース名・認証・移行手順を[Cloudflareセットアップ](docs/cloudflare.md)で確認してください。
`dev-template`は内部パッケージとリソースの雛形名です。新規環境では名前とService Bindingを一緒に見直し、
既存環境へ同名で配備しないでください。

## ローカル起動

Node 24.19.0・pnpm 11.21.0を使います。

このリポジトリをcloneしてください。別の所有者・名前で作成した場合はURLとディレクトリ名を置き換えます。

```sh
git clone https://github.com/toruSakari/agent-ready-boilerplate.git
cd agent-ready-boilerplate
```

nvmを使う場合は`nvm install`・`nvm use`で`.nvmrc`に指定されたNodeを選びます。
`corepack`が見つからない場合は、先に`npm install -g corepack`を実行してください。

初回は依存関係・環境変数・ローカルDBを準備してから起動します。
既に`apps/api/.dev.vars`がある場合はコピーを省略し、設定を維持してください。

```sh
corepack enable
corepack pnpm install --frozen-lockfile
cp apps/api/.dev.vars.example apps/api/.dev.vars
corepack pnpm db:migrate:local
corepack pnpm db:seed:local
corepack pnpm dev
```

初期設定はローカル用のデモ認証とローカルD1です。ClerkのキーやCloudflareへのログインは不要です。
`pnpm dev`はAPIと3画面の計4つのWorkerを起動し、`Ctrl+C`でまとめて停止します。

| アプリ           | URL                              |
| ---------------- | -------------------------------- |
| 一般ユーザー画面 | http://127.0.0.1:5173            |
| 事業者画面       | http://127.0.0.1:5174            |
| 運営画面         | http://127.0.0.1:5175            |
| APIの稼働確認    | http://127.0.0.1:8787/api/health |

次回からは`corepack pnpm dev`で起動できます。マイグレーションが追加された場合は
`corepack pnpm db:migrate:local`を再実行します。seedは毎回実行する必要はありません。

一般ユーザー画面のトップは公開の商品一覧です。検索・商品詳細・カートは会員登録前に使え、購入・注文履歴・本人の出荷前注文の取消は通常会員で利用します。販売企業への所属は不要です。企業ごとに注文し、実決済・配送は行わないデモ注文です。

seedは企業2社の商品6点（無料商品1点を含む）と各50個の在庫を用意します。再実行しても編集済みの商品名・価格・画像・在庫を上書きしません。

事業者画面は企業の概要・注文・商品・メンバー・設定、運営画面は全体の概要・企業・ユーザー・権限を専用ページで扱います。
[画面構成と購入の方針](docs/adr/028-commerce-storefront-and-dashboards.md)を参照してください。

デモ管理者は企業A・Bに所属し、事業者画面で企業を選びます。
企業が1社なら自動で入り、URLに企業IDを持たせるのでタブごとに別企業を開けます。

デモ認証はローカルだけで使用できます。x-demo-user・x-demo-emailはテスト用です。
x-demo-role=memberはローカルの閲覧担当を選びますが、実際の権限はDBで判定します。
x-organization-idは操作する企業IDで、必ず所属確認します。本番・PreviewはClerk認証です。

## ローカルでClerk認証を確認する

デモ認証ではなく実際のログイン・Cookie・セッションを検証する場合は、Clerkの開発用インスタンスを使います。
[Clerk Dashboard](https://dashboard.clerk.com/)で開発用インスタンスを作成し、
`apps/api/.dev.vars`へ`CLERK_SECRET_KEY=sk_test_...`と`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...`を設定します。
秘密鍵はチャット・Git・ログへ貼らず、ローカル設定ファイルだけに保存してください。

```sh
corepack pnpm clerk:setup
corepack pnpm dev
```

`clerk:setup`はAPIの`AUTH_MODE`を`clerk`へ切り替え、APIと3画面へ同じ秘密鍵・許可オリジンを設定します。
3画面の`.env.local`には公開鍵だけを設定し、既存の他の設定は保持します。起動済みなら再起動してください。
以後の`pnpm dev`ではデモ認証を使わず、Clerkで本人確認します。
公式CLIなどで用意した環境変数ファイルを使う場合は`corepack pnpm clerk:setup <ファイルパス>`を実行できます。
`VITE_CLERK_PUBLISHABLE_KEY`も読み取れます。開発用の鍵だけを受け付けます。

メールOTPを試す場合は`user+clerk_test@example.com`と確認コード`424242`を使えます。
Clerkの開発用サービスへのネットワーク接続は必要です。
[開発用インスタンス](https://clerk.com/docs/guides/development/managing-environments)、
[テストメール](https://clerk.com/docs/guides/development/testing/test-emails-and-phones)を参照してください。

Clerkのユーザーとアプリの会員・企業所属は別です。ログインだけではデモ管理者の権限を取得しません。
一般ユーザーは`/register`で登録し、企業・運営は招待または[初期管理者の登録](docs/cloudflare.md)を使います。
既存のデモ管理者があるDBでは初期管理者の追加が拒否されるため、Clerk検証用にはデモseedを入れない別のローカルDBを用意してください。

## ER図を見る

```sh
pnpm db:er
```

Drizzle Lab 0.11.0で`apps/api/drizzle.config.ts`のスキーマを読み込み、ローカルのERビューアーを起動します。
起動ログに表示されるURLを開いてください。初回はツールの取得が必要です。DBのマイグレーションや実データの読み取りは行いません。

## Storybookでコンポーネントを見る

```sh
pnpm storybook          # http://127.0.0.1:6006
pnpm build-storybook    # storybook-static/へ静的ビルド
pnpm test:stories       # 全storyの描画とplayをjsdomで検証
```

Storyは共有パッケージと各アプリのsrcにある対象コンポーネントと同じ階層の`<名前>.stories.tsx`に置きます。
共通UI・業務表示・フォーム・画面のまとまりを、ライト／ダーク／システムテーマで確認できます。
Clerkや実APIには接続せず、各storyの架空データを使います。
[配置・fixture・検証の手順](docs/storybook.md)を参照してください。

## サービス別の会員登録と退会

Clerkは本人確認だけを担当し、通常会員customer_accounts、企業担当者business_accounts、
運営operator_accountsは別々に登録します。企業だけの登録者は通常会員側では未登録です。
同じClerk subject・メールでも、別サービスへ自動登録しません。
一般ユーザーはログイン後に/registerで明示的に登録し、企業所属を持ちません。企業に紐付くのは商品・注文と企業担当者の所属です。
企業・運営は対象サービスの招待承諾で登録し、運営の初期管理者だけbootstrapを使います。

/accountから退会すると、そのサービスの会員だけを匿名化し所属を解除します。
他サービスの登録・企業所属・Clerkログインは残ります。再登録は新しい会員IDになり、過去の注文や権限を引き継ぎません。
最後の企業オーナー・運営管理者は先に権限を引き継ぐ必要があります。

会員登録、対象企業の所属、操作パーミッション、本人の注文所有をサーバーで別々に確認します。
画面は登録とセッションの確認前に業務シェルを表示しません。運営が企業権限へフォールバックすることもありません。
3画面は`app/routes`の`_authenticated`のbeforeLoadで本人を確認し、その内側の`_qualified`の
beforeLoadで必要なサービス会員と遷移先企業を確認します。layoutは表示中の認証・資格の監視を維持します。`/account`は本人確認だけ、ログイン・招待・web登録はgroupの外です。
Root Providersには各appがサービス・選択企業を明示し、コンテキストとキャッシュだけを共有します。
企業URLの解釈、webの登録CTA、businessの業務メニューは各appが持ちます。ProxyはClerkのCookie・ハンドシェイクを同期します。
画面ガードだけに依存せず、データの認証・認可はAPIで毎回確認します。
[ルート構成と認証の責務](docs/adr/019-frontend-request-authentication.md)を参照してください。
RPCは全画面で共通の/api/trpcを使います。複数サービスで利用する手続きはservice入力で操作する会員を指定し、
サーバーが本人の対象サービス会員・企業所属・操作権限を検証します。URLや画面を変えても権限は増えません。
旧/api/business/trpc・/api/admin/trpc・/api/customer/trpcと不明な入口は404です。
画像の取得・追加・代表画像の差し替え・削除もproductのtRPC手続きへ統一します。
getImageはservice=customerまたはbusinessを入力し、更新は企業会員に固定します。旧/api/productsの画像入口は404です。
運営のすべての操作でCloudflare Access検証を維持します。
本人確認はリクエストごとに一度行い、Hono ContextのactorをtRPC Contextへ引き継ぎます。
各手続きに会員種別・現在権限のガードを直接宣言し、通常のactorデータをユースケースへ渡します。
画像アップロードのFormDataは企業会員・現在権限の確認後に読み込みます。
ユースケースは汎用認可を繰り返さず、対象企業・本人注文・状態などの業務制約を扱います。
画面内の独立した一覧はAPIの403で対象セクションだけを隠し、取得できる一覧は残します。通信障害はエラーとして表示します。
[共通APIの契約と認可](docs/adr/018-url-independent-procedure-authorization.md)を参照してください。
[会員分離の設計](docs/adr/015-independent-service-accounts.md)を参照してください。
ドメインもCustomerAccount・BusinessAccount・OperatorAccountとサービス別ユースケースに分け、
登録・退会・運営停止をそれぞれのルールで扱います。[ドメインモデルの分離](docs/adr/016-service-account-domain-models.md)を参照してください。

## 企業・ユーザー管理

運営は企業を作成・停止し、初期オーナーと企業ユーザーを招待できます。
企業一覧・ユーザー一覧では企業名・名前・公開を許可されたメール・ロールで検索できます。
運営の全体閲覧、個人情報閲覧、企業作成、招待、所属解除、アカウント削除を別パーミッションで制御します。

企業側の管理者は自社メンバーの権限を変更できます。企業からの招待は運営が企業単位で許可します。
運営・企業の双方でカスタムロールを作成できます。最後のオーナーの削除・降格と権限の自己昇格を防ぎます。
招待は本人の確認済みメールによる承諾方式です。自動メール送信は行わず、発行したリンクを本人へ共有します。

所属解除は他企業への所属を維持します。運営のアカウント削除も指定されたサービス会員だけを対象にします。
注文・監査の会員IDと退会行を履歴として残し、Clerkユーザーは削除しません。
[業務ルールと受け入れ条件](docs/project/use-cases/manage-organizations.md)を参照してください。

## 企業画面のIP制限

運営の企業管理画面で、企業ごとの許可IP・CIDR（IPv4・IPv6）と制限の有効・無効を設定できます。
企業を選択した企業担当者のAPI要求で現在の許可範囲を検査し、範囲外は403で拒否します。
一般ユーザー・運営操作、本人の退会・招待承諾は対象外です。誤設定は運営画面から解除できます。
[信頼する接続元・移行・受け入れ条件](docs/adr/022-business-ip-restriction.md)を参照してください。

## プランの権限上限

通常会員は個人、企業担当者は選択企業のプランを使い、APIはロールと現在のプランの両方が許可する操作だけを実行します。
企業のプランは運営画面の「企業一覧 → 企業詳細 → 基本設定」で変更します。対象企業は固定し、現在のプランを初期表示します。一般ユーザーのプランは本人が通販画面の「会員情報」で変更・解除します。未設定でも選択でき、運営からは変更できません。
プラン変更でロール定義は消さず、利用可能な権限だけを変えます。運営は料金プラン対象外ですが、運営の操作権限は必要です。
開発用のプランと割当は小さな設定とseedへ直接用意します。商用の料金・課金連携は含みません。
[プランの所有・判定・開発用seed](docs/adr/020-plan-permission-caps.md)を参照してください。

## 注文・商品サンプル

注文を作成するのは一般ユーザーです。企業画面では自社への受注の下書き編集・確定・キャンセル・出荷・完了と商品・画像管理を試せます。企業から注文は作成できません。
一般ユーザー画面では自分の注文だけを扱い、出荷・完了・企業権限管理は許可しません。
在庫予約は企業・SKU単位のDurable Object、正本はD1、非同期処理はOutbox＋Queueです。
Paymentはデモ決済で実課金しません。商品は複数画像に対応し、非公開R2へ保存して認証付きAPIで取得します。
差し替え・削除した画像は7日間以上保持し、参照がないものだけ定期処理で削除します。
画像取得は1枚ずつtRPCのJSON応答（base64・contentType・etag）を受け取り、ブラウザーでBlobへ復元します。
画像本体の上限は5MiB、multipart全体の上限は6MiBです。FormDataと画像取得はバッチ化しません。
[画像管理の受け入れ条件](docs/project/use-cases/manage-product-images.md)、
[tRPCの画像契約と容量制限](docs/adr/021-product-image-trpc.md)、
[保存・削除の整合性](docs/adr/012-product-image-lifecycle.md)を参照してください。

[注文管理のルール](docs/project/use-cases/manage-order.md)、
[状態型](docs/adr/008-domain-state-types.md)、
[Value Objectとクライアント契約](docs/adr/009-domain-value-objects.md)を参照してください。

## 商品の在庫登録

企業画面の「商品を登録」で、価格とあわせて「初期在庫（個）」を入力します。0個も登録できますが、その商品は購入できません。商品と初期在庫は同時に保存され、片方だけの登録は残りません。

企業ナビゲーションの「在庫」から、商品ごとの在庫数・予約中・購入可能数を確認できます。「在庫管理」で商品詳細を開き、次の操作を選びます。

- **入荷**：受け入れた数量（1個以上）を現在庫へ加算します。例：現在3個に10個入荷すると13個です。
- **棚卸し・訂正**：確認した実数（0個以上）へ変更します。例：現在13個で実数が9個なら9個を入力します。

変更理由を選んで保存すると、変更前後の数量・日時・担当者・理由を履歴に残します。通信の再試行で入荷を二重加算しません。予約中の数量より少ない在庫や、古い値からの棚卸しは拒否されます。「最新の在庫を確認」で確認してください。操作には企業の商品更新権限が必要です。注文による変動は注文履歴で確認します。

更新後は `pnpm db:migrate:local` で履歴テーブルを追加してください。既存商品への入荷・棚卸しにシーダーの再実行は不要です。過去の操作履歴は自動生成しません。

設計・整合性は[ADR 031](docs/adr/031-product-initial-stock-and-inventory-management.md)を参照してください。

## 検証

```sh
pnpm format
pnpm check
pnpm test
pnpm test:harness
pnpm build
pnpm test:e2e
```

テストは対象ファイルと同じ階層、ブラウザの受け入れテストはe2eに置きます。
各画面の隣接テストは`pnpm --filter @dev-template/business test`などで実行できます。
web・business・adminはそれぞれ自分のVitest設定とsetupを持ち、切り出し後も`pnpm test`で実行できます。
全storyとアプリ間の契約はモノレポのルートで検証します。
APIは日本語エラー・HTTPステータス・内部情報の非公開を確認します。
外部ツールに起因して修正できない警告は、原因・影響・解消条件を完了報告やPRに残します。

## 配備

```sh
pnpm db:generate
pnpm db:preflight
pnpm db:migrate:remote
pnpm build
pnpm deploy
```

APIにはClerk秘密鍵と運営用Cloudflare Accessの設定が必要です。運営画面と運営APIの両方を保護し、
IP制限・MFAはAccessポリシーで設定します。設定がなければ本番の運営APIは拒否します。
初期管理者の登録、既存テナント移行、Previewの分離は[配備手順](docs/cloudflare.md)に記載しています。

外部キー列の命名規則と0012移行時の停止・切替手順は
[ADR 013](docs/adr/013-foreign-key-column-names.md)を参照してください。
0014は通常・企業・運営の会員を分離する前進移行です。0013までの履歴は書き換えません。
旧APIと書き込みを停止し、会員・所属・注文・監査の対応をレビューして移行します。曖昧な対応では停止します。
旧招待は再発行が必要です。[移行の手順](docs/cloudflare.md#会員アカウントを分離する移行0014)を確認してください。

## セキュリティ境界

APIは未完了・失効セッションを拒否し、Durable ObjectによるIP・本人別スロットルをミドルウェアで実行します。
通常バッチは20件まで、注文・商品一覧はページングし、画面にはnonce付きCSPと埋め込み防止ヘッダーを適用します。
PreviewのDB・画像・QueueもPRごとに分離します。
監視の設定と依存パッチの制約は[ADR 023](docs/adr/023-security-boundaries-and-resource-limits.md)を参照してください。

## Codexハーネス

[Codexハーネス](docs/codex-harness.md)とAGENTS.md、.agents/skillsの手順に従います。
Git hooksはpnpm hooks:install、Codex hooksはCLIの/hooksで有効化します。
別業務へ新規cloneして使う場合は`$bootstrap-project`から始め、[初期適用](docs/project-guide.md#別ドメインへの初期適用)に従って
用語・利用者・境界と、サンプルの残す／置き換える範囲を決めます。

検証手順と確認上の注意は[検証ガイド](docs/project/verification.md)を参照してください。

アプリを別リポジトリへ切り出す場合は[切り出し手順](docs/repository-split.md)を参照してください。
`pnpm repository:export api --out ../api-repository`で、共有依存を固定した独立アプリを出力できます。

## 一覧の検索と絞り込み

企業の注文・商品・在庫、一般ユーザーの注文履歴と公開商品、運営の企業一覧に検索条件を指定できます。
状態の選択は即時反映し、検索・期間・価格・並び替えは「絞り込む」で適用します。「条件を解除」で先頭へ戻せます。
条件はURLに保持し、全対象をサーバーで絞り込んでからページを取得します。
注文の開始・終了日は日本時間で、その日の終わりまでを含みます。在庫状態は予約を差し引く前の台帳在庫です。
この変更のDBマイグレーションはありません。在庫機能の0020が未適用なら`corepack pnpm db:migrate:local`を実行してください。
調査・未決定事項は[一覧のリサーチ](docs/project/list-filter-research.md)、設計は[ADR 032](docs/adr/032-server-list-filters.md)を参照してください。

## ライセンス

このプロジェクトは[MIT License](LICENSE)で提供します。第三者コードと依存パッケージには、それぞれのライセンスが適用されます。
同梱コードの著作権表示と条件は[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)を参照してください。
