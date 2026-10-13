# Cloudflareセットアップ

## 手動操作の範囲

この公開テンプレートのGitHub Actionsは検証用CIだけです。本番配備・PRプレビュー配備・
プレビュー削除のワークフローは含みません。push・PR作成・PR終了だけでは実リソースを操作しません。
以下のリソース作成・remote移行・secret設定・配備・削除コマンドは、利用者が対象と影響を確認して
手動で実行するための例です。ローカル起動だけなら実行する必要はありません。
CIのためにCloudflareやClerkの秘密鍵をGitHubへ登録する必要はありません。
自動配備が必要になった場合は、自分の環境・承認手順・最小権限に合わせて別途設計してください。

## Workerとリソース

雛形の業務APIのWorker名は`dev-template`、顧客・事業者・運営はそれぞれ
`dev-template-web`・`dev-template-business`・`dev-template-admin`です。
新規環境では既存リソースと衝突しない名前を決め、4つのWrangler設定・Service Binding・
Previewスクリプトの名前を一貫して変更してください。既存環境を移行する場合は、Worker名と
InventoryReservationのDurable Object名前空間を維持し、処理中の予約を引き継ぎます。
画面側はAPIへのService Bindingだけを持ち、D1・R2・Queue・DOは共通APIだけに設定します。

```sh
pnpm exec wrangler d1 create dev-template
pnpm exec wrangler r2 bucket create dev-template-product-images
pnpm exec wrangler queues create dev-template-order-events
```

apps/api/wrangler.jsoncの仮のD1 IDを実値に置き換えてください。企業・権限テーブルは0007、
0007では在庫・割当にも企業ID列を追加します。パーミッションとrevision初期値は0008、
在庫の企業ID・SKU複合主キーは0009、外部キー列の改名は0012、旧資格モデルは0013、独立会員への移行は0014です。
0013までの履歴は保持しますが、現在の認証は0014のサービス別会員だけを使います。デモユーザーは本番移行に含めません。
既存環境では、下記の移行手順を済ませてから全マイグレーションを適用してください。

```sh
pnpm db:migrate:remote
```

## 認証・ドメイン・運営入口

顧客・事業者・運営のWorkerへそれぞれ別ドメインを割り当てます。
例：example.com・business.example.com・admin.example.com。
Clerkの本人確認を共有し、アプリケーションDBの通常・企業・運営会員と所属・ロールは独立させます。
Clerkへのサインアップだけでは会員登録しません。通常会員は/registerで明示的に登録し、対象企業へは招待で所属します。
企業・運営は対象サービスの招待を承諾して登録します。退会は当該サービスだけに作用し、Clerkユーザーを削除しません。

```sh
pnpm exec wrangler secret put CLERK_SECRET_KEY --config apps/api/wrangler.jsonc
pnpm exec wrangler secret put CLERK_SECRET_KEY --config apps/web/wrangler.jsonc
pnpm exec wrangler secret put CLERK_SECRET_KEY --config apps/business/wrangler.jsonc
pnpm exec wrangler secret put CLERK_SECRET_KEY --config apps/admin/wrangler.jsonc
pnpm exec wrangler secret put SENTRY_DSN --config apps/api/wrangler.jsonc
```

SENTRY_DSNは任意です。各画面のビルド時にNEXT_PUBLIC_CLERK_PUBLISHABLE_KEYを設定します。
4つの秘密鍵と公開鍵は同じClerkインスタンスに揃えます。秘密鍵はサーバー専用で、
NEXT_PUBLIC変数やReactのpropsへ渡しません。3画面のproxy.tsはCookieと更新ハンドシェイクを同期し、
画面の本人確認・サービス資格は各appのroute group/layoutで明示します。同期用の鍵が未設定の本番・Previewは503です。
本番の運営画面にはNEXT_PUBLIC_BUSINESS_ORIGIN（例：https://business.example.com）、
運営・事業者画面にはNEXT_PUBLIC_CUSTOMER_ORIGIN（例：https://example.com）も必要です。
事業者・顧客招待を対応する画面の入口へ案内するURLに使います。
事業者画面の事業者招待と運営会員の招待には、それぞれの画面自身のオリジンを使用します。

Cloudflare Accessで運営ドメイン全体を保護し、IdP・MFAと必要なIP範囲をポリシーで制限します。
共通APIはADMIN_ACCESS_ISSUER（例：https://example.cloudflareaccess.com）と
ADMIN_ACCESS_AUDIENCE（AccessアプリケーションのAUDタグ）を設定します。
ブラウザのAccess JWTを画面のAPIプロキシが渡し、共通APIが署名・発行者・AUD・期限を検証します。
Clerk認証、有効なoperator_accountsの会員とplatform所属、DBの運営パーミッションも必要です。
JWT欠落や未設定なら403で拒否します。企業の権限を運営権限の代わりには使いません。

CLERK_AUTHORIZED_PARTIESには3つの画面オリジンをカンマ区切りで設定してください。
空欄ではClerkモードを起動できません。Clerkダッシュボードでも各画面のドメインを許可します。
APIの設定はapps/api/wrangler.jsoncのvarsか、API配備コマンドの環境変数で指定できます。
3画面にも各apps/{web,business,admin}/wrangler.jsoncのvarsで同じCLERK_AUTHORIZED_PARTIESを設定します。
本番は末尾のスラッシュなしのhttps originを使います。要求URLとJWTのazpをこの明示リストで検証します。
ローカルClerk検証ではAPIの.dev.varsへ開発用秘密鍵とNEXT_PUBLIC_CLERK_PUBLISHABLE_KEYを設定し、
`pnpm clerk:setup`でAPIと3画面を同じインスタンスへ接続してから再起動します。
手順とテストメールは[README](../README.md#ローカルでclerk認証を確認する)を参照してください。
デモ通過は開発ビルド・APP_ENV=local・loopback・鍵未設定の場合だけです。
IPやMFAのポリシー自体の作成にはCloudflareの実環境設定が必要です。

## 初期管理者

Clerkで本人のアカウントと確認済みメールを用意し、そのユーザーIDで初期管理者を登録します。
0014まで適用したDBへoperator_accountsとplatform所属だけを明示的に作成します。通常・企業会員は作成しません。
対象アカウント・権限付与・実行環境を確認し、本番実行の承認を得てから次のコマンドを使ってください。
既存の運営管理者がいる場合、このコマンドで追加の管理者権限を与えません。
追加の運営メンバーは管理画面の招待から登録します。

```sh
pnpm access:bootstrap --remote --user-id user_xxx --email admin@example.com --name 初期管理者
```

企業の作成直後はメンバーがいません。運営がその企業のオーナーを招待し、本人が承諾して利用を開始します。
企業からのユーザー招待は初期状態で無効です。運営が企業の設定から明示的に許可します。
準管理者は運営管理者がカスタムロール機能で必要な権限を選んで発行できます。

## 既存環境の移行

1. D1をバックアップし、処理中の注文・予約・Outbox・Queueを完了させる。このDBを共有する全API・Queue consumer・定期実行を停止する。
2. 保守時間内に未適用分を0013まで順番に適用する。0009・0012と新APIの切替条件を守り、旧APIは停止したままにする。
3. 既存orders・productsのtenant_idに対応するorganizationsを同じIDで確認する。既存在庫・割当の企業も確認し、
   LEGACY_INVENTORY_TENANT_IDと一致させる。旧共有SKUの複数企業への分配は個別設計が必要で、自動推定しない。
4. 下記0014の対応表で本人・サービス・所属・注文所有者・監査の帰属をレビューし、保守時間内に原子的に移行する。
5. 新APIと3画面を配備する。必要なら承認済みの初期運営bootstrapを行い、旧招待を対象サービスへ再発行する。
6. 未登録・退会済み・異なるサービスの拒否、同一subjectの各サービス分離、通常会員退会後の企業利用継続、
   本人注文・画像・既存在庫を確認してから受付を再開する。

既存IDをランダムな新企業IDへ置き換えないでください。注文・画像のテナントキーが変わります。
所属移行が終わっていないユーザーは新APIに拒否されます。旧Worker名を変更するとDOの予約が
失われるので、APIの名前と既存InventoryReservation名前空間は維持します。新規企業は別の
TenantInventoryReservation名前空間で企業・SKUをキーに予約し、既存SKUと衝突しません。
LEGACY_INVENTORY_TENANT_IDは移行後も変更しないでください。切り替え前にD1バックアップと所属マッピングを保存します。
旧認可へのロールバックは削除・権限変更を無効にするため、通常は新APIで前進修正します。

## 外部キー列名を統一する移行（0012）

`0012_referenced_table_fk_columns.sql`は8つの外部キー列を参照先テーブル名＋`_id`へ変更します。
既存の値・型・参照先・インデックス・削除時の動作は維持しますが、旧APIのSQLとは互換性がありません。
D1バックアップを取得し、このDBを共有する全API受付・Queue consumer・定期実行など旧APIのDBアクセスを停止してから
0012まで適用し、新APIを配備・確認して再開してください。移行とコード配備の間も旧APIを稼働させないでください。
本番配備前の`db:preflight`とPreviewスクリプトの事前確認は、旧列の残存を検出するとデータの有無にかかわらず停止します。
この外部キー検査は新規DBと0012適用済みDBだけが通過し、その後に0014の会員分離・履歴保護検査も行います。
`db:preflight`を迂回して通常稼働中のDBを移行しないでください。
承認された保守時間内に停止・移行・新API配備を完了した後、運用を再開してください。
詳細と列名対応は[ADR 013](adr/013-foreign-key-column-names.md)を参照してください。

## 会員アカウントを分離する移行（0014）

0013は履歴として残しますが、資格の追加登録を現在の移行手段として使いません。
0014_independent_service_accounts.sqlが独立した通常・企業・運営会員へ前進移行します。
ロール名、パーミッション、メール、Clerk属性、0013の資格からサービスや注文の帰属を推測しません。

本番・共有Previewの移行、対応表の登録、旧招待の再発行、bootstrapは別途承認が必要な運用作業です。
次の順序、保守時間、責任者、対象Worker・D1、バックアップと復旧方法をレビューしてください。

1. 全受付を停止し、処理中の注文・予約・Outbox・Queueを完了させる。このD1を共有する全API・Queue consumer・
   定期実行を止め、旧APIが再起動しないことを確認する。停止後のバックアップを保管する。
2. 0013まで適用済みのDBでapps/api/tooling/service-account-migration-map.sqlを実行する。
   このファイルは空の対応表を用意するだけで、会員・権限を推測登録しない。
3. 次の対応表を業務責任者とレビューし、reviewed_by・reviewed_atとともに明示的に登録する。
   - service_account_migration_map：legacy_account_id、category、account_id、subject_id
   - service_membership_migration_map：legacy_membership_id、account_id、membership_id、access_roles_id、enabled
   - service_order_migration_map：orders_id、account_id
   - service_audit_migration_map：audit_id、actor_account_id、target_account_id（会員対象の操作では必須）

   新会員ID・所属IDはcustomer:、business:、operator:の対応する接頭辞と新しい一意IDを使う。
   共通subjectと会員IDを同じ値にしない。同一の旧会員を複数サービスへ移す場合も各行を明示する。
   ロールもaccess_roles_idへ明示する。旧共有所属が複数サービスに分かれる場合、各サービスに別ロールを指定できる。
   顧客の有効な所属は非保護・顧客向け権限だけのロールを指定し、必要なら保守中に先にそのロールを用意する。
   無効だった所属はenabled=0で分類を記録し、権限を復活させない。停止企業・退会済み・所属のない会員も確認する。
   旧注文所有者にaccounts行がない場合は、本人を確認した退会済み履歴行を先に用意し、推測して現役会員へ結び付けない。
   注文・監査の旧IDと対応表の旧会員IDが一致することが必要。対応を決められない場合は移行を保留する。

4. 0014をD1マイグレーションとして一括適用する。移行ファイルを文ごとに分けて本番DBへ流さない。
   全旧会員・所属・注文・監査の対応漏れや不整合で停止する。自動分類で検査を通さない。
   新会員・所属を作り、注文所有者と監査の帰属を対応表どおりに切り替える。旧accounts・memberships・actor_qualifications、
   access_audit_legacyおよび対応表は書き込み禁止の履歴として残す。元OutboxのIDは保持し対応表から追跡する。
   旧招待は失効する。移行後の新APIから再発行し、旧トークンで承諾できないことを確認する。
5. pnpm db:preflightで0012の外部キー列、0014の必要テーブル・履歴保護トリガー・外部キー整合性を確認する。
   成功は対応表の業務上の正しさや切替安全性の承認を意味しない。会員・所属・注文・監査の件数と内容も照合する。
6. 新APIと3画面を配備し、通常会員/register、各/account、企業・運営招待、最後の管理者保護を検証する。
   企業だけ登録済みの本人が通常会員側で未登録になること、通常会員退会後も企業側の利用が続くことを確認する。
   再登録で旧注文・所属・古い招待が引き継がれないこと、同じメールの別subjectが結合されないことも確認してから再開する。

preflightは読み取り専用です。完全に空の新規DBと0014適用済みDBだけが通常の配備手順へ進めます。
旧共有DBは空の所属表でも手動の保守切替が必要です。既存データを消去してガードを回避しないでください。
失敗時はAPIと書き込みを停止したまま前進修正します。旧APIだけを戻して会員分離を取り除かないでください。
[ADR 015](adr/015-independent-service-accounts.md)に判断理由を記録しています。

実環境のD1、Clerk、Cloudflare Access、資格情報・セキュリティ設定はこのコード作業では変更していません。
文書の実環境向けコマンドも未実行です。

## 配備順序

既存環境の初回切り替えは、上記の書き込み停止・データ移行を伴う作業として実施します。
移行コマンドだけで既存在庫の企業割当を解決できません。新規環境と移行済み環境では次の順です。

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm build
pnpm db:preflight
pnpm db:migrate:remote
pnpm deploy
```

deployはAPI→web→business→adminの順に配備します。Workerごとの更新は原子的ですが、
4つをまとめたトランザクションではありません。API契約は既存クライアントと互換性を保って追加し、
失敗した画面だけを再配備できます。データ移行や秘密鍵・ドメインの設定はCIが自動生成しません。
手動配備でも対象アカウント・環境設定と必要な承認を確認します。
配備前のdb:preflightは、0012より前の外部キー列、0014未完了・履歴保護不備の既存DB、
または旧主キーのDBに在庫・割当・注文がある場合に停止します。
移行済みDBまたは空の新規DBだけが通常の移行手順へ進めます。このチェックは書き込み停止の代わりにはなりません。

実行環境でCLOUDFLARE_API_TOKEN・CLOUDFLARE_ACCOUNT_ID・NEXT_PUBLIC_CLERK_PUBLISHABLE_KEYを設定します。
APIと3画面のCLERK_SECRET_KEYはWrangler secretで設定します。ADMIN_ACCESS_ISSUER・
ADMIN_ACCESS_AUDIENCE・CLERK_AUTHORIZED_PARTIES・NEXT_PUBLIC_BUSINESS_ORIGIN・
NEXT_PUBLIC_CUSTOMER_ORIGINも対象環境に合わせて設定します。秘密値はGitへ保存しません。

## PRプレビュー

PRプレビューは手動コマンドで作成・削除します。PRの作成・更新・終了では配備も削除も行いません。
CIとRepository BoundariesはドラフトPRでも検証を実行します。

Service Bindingの接続先を本番から分けるため、PR番号ごとに4つの通常Workerを作成します。
Worker Preview機能ではなく、専用名のWorkerを配備する方式です。

```sh
pnpm build
pnpm deploy:preview 123
pnpm preview:delete 123
```

名前はdev-template-{api,web,business,admin}-pr-123です。画面のAPI bindingは同じPRのAPIを指します。
D1・R2・Queueはtooling/preview.mjsがPR専用の名前で作成し、同じPRでの再配備では再利用します。
DOはAPIのWorker名ごとに分離します。Queue consumerも接続し、Preview内で注文の非同期処理を確認できます。
既存の共有Previewリソースへは接続しません。旧共有リソースは運用でデータ保持方針を確認して別途整理してください。
Preview配備も旧列・0014未完了・履歴保護不備のいずれかがあれば事前確認で停止します。
必要なToken権限はWorkers配備・secret管理に加え、D1・R2・Queueの作成・読取・削除です。
プレビューが不要になったら、対象PR番号を確認して`pnpm preview:delete <PR番号>`でWorker、専用画像、R2、Queue、D1を削除します。未追跡画像がある場合の失敗を確認し、専用バケットだけを手動清掃してください。
Clerk鍵はAPIと3画面のすべてへsecretとして設定します。

実行環境のCLERK_SECRET_KEYへPreview用のClerk秘密鍵を設定します。
NEXT_PUBLIC_BUSINESS_ORIGINにはそのPRのbusiness Worker、NEXT_PUBLIC_CUSTOMER_ORIGINには
web WorkerのURLを設定してからビルドします。雛形名を使う場合は
`https://dev-template-business-pr-123.<自分のWorkersサブドメイン>.workers.dev`のように、
PR番号と対象アカウントを一致させます。NEXT_PUBLIC_CLERK_PUBLISHABLE_KEYも同じClerkインスタンスに揃えます。
配備スクリプトはAPIと3画面へPreview用の秘密鍵を設定します。
フロントエンドはPreview用の許可オリジンを使用します。秘密鍵を持たないPreview画面は503で拒否します。
ClerkとAccessでもPreviewドメインを許可し、運営Preview全体を同じAUDで保護します。
Previewでもoperator_accountsと初期管理者の所属の明示的な登録が必要です。デモseedは適用しません。

PRを閉じてもリソースは残ります。手動の削除コマンドの完了を確認し、不要な課金を防いでください。
共有Preview D1・R2のデータは削除コマンドの対象外です。
Accessのポリシー・プロフィール・ログの保持も別途運用してください。

## キャッシュ・ログ

所属・権限・個人情報・認証付き画像はprivate,no-storeです。stale-while-revalidateで
古い認可を使い続ける設定は追加しません。変更操作と個人情報閲覧を監査します。
Clerkのプロフィール・バックアップとD1の監査データには保持・削除ポリシーを設けてください。

Observabilityは有効です。SENTRY_DSNを設定するとAPIをSentryでラップします。
アプリログは共通の固定イベントと許可リストを使い、個人情報・秘密・本文を収集しません。
Sentryは自動収集を停止し、イベントとトレースを送信前にもフィルターします。
Cloudflare・Clerk・Access等のプラットフォーム側のログは別途、収集項目・保存期間・閲覧権限を確認してください。
既に保存された個人情報・秘密のログも運用側で確認し、必要な削除やトークンの失効を行います。
詳しくは[ADR 023](adr/023-security-boundaries-and-resource-limits.md)を参照してください。

## ローカル設定とデータの配置

APIの設定・実装・SQL・seedはapps/apiにあります。ローカルの秘密値はapps/api/.dev.vars、
DB・R2・DOのローカルデータはapps/api/.wranglerに保存します。既存データを移す必要がある場合は
Workerを停止し、バックアップを取り、移動先のデータを上書きしないことを確認してください。

ルートではpnpm db:migrate:localなどの共通コマンドを使えます。API単独で操作する場合は
cd apps/api後に同じコマンドを使います。Previewなど複数アプリの配備をまとめるスクリプトはルートのtoolingに残します。

ローカルのデバッガーポートはAPI=9229、web=9230、business=9231、admin=9232です。
複数Workerの同時起動で自動選択が競合しないよう、画面の共通設定にポートを明示しています。

## APIの接続契約

RPCは全画面で`/api/trpc`を使います。APIとweb・business・admin、公開型契約を同じ版へ更新し、古い画面を
再読み込みしてください。`/api/business/trpc`・`/api/admin/trpc`・`/api/customer/trpc`と不明な入口は404です。
各画面のプロキシが同じAPIパスを転送し、所属・操作権限の判定は共通APIで行います。

複数サービスで使う手続きには操作する会員を選ぶ`service`入力が必要です。顧客・企業を扱う注文と商品一覧は
`customer`または`business`、登録状態・セッションなどは`operator`も受け付けます。
専用手続きの対象会員と、各手続きの正確な入力は[ADR 018](adr/018-url-independent-procedure-authorization.md)を参照してください。
登録状態確認・招待承諾・通常会員登録・退会は単独で呼び出し、他の手続きとバッチ化しないでください。

画像も`/api/trpc`の`product.getImage`・`addImage`・`replaceImage`・`deleteImage`へ統一します。
取得はJSONの`{ id, service, imageId? }`で`service: "customer" | "business"`を指定し、
`{ base64, contentType, etag }`を受け取ります。追加・代表画像の差し替えは`id`と`file`を入れたFormData、
削除はJSONの`{ id, imageId? }`です。更新・削除は企業会員で認可します。
FormDataと画像取得には単独の`httpLink`を使います。multipart全体は6MiB、画像本体は5MiB以下に制限します。
旧`/api/products`・`/api/customer/products`配下の画像パスは404で、バイナリ応答や互換転送は残しません。
画像を使う外部クライアントも[ADR 021](adr/021-product-image-trpc.md)に従って更新してください。
API・各画面・公開型契約を同じ版へ切り替え、古い画面を再読み込みする必要があります。

DBを持つ既存環境では、0012・0014など該当する移行要件を確認してください。
共通Clerk本人確認と独立したサービス会員を維持し、運営の登録状態確認・招待承諾・退会・healthを含む
すべての運営操作でCloudflare Accessを検証します。API共通化を理由にAccessやClerkの設定を緩和しないでください。

## セキュリティ監視と要求制限

APIは本人確認前のIPスロットルと本人確認後の操作数スロットルを共通ミドルウェアで実行します。
Clerkのpending・失効セッションは拒否します。最大20件のバッチ、カーソル方式の一覧取得上限、商品画像20件の上限もサーバーで保証します。

Cloudflare Workerログのcategory=securityを5分単位で集計し、authentication_rejected、authorization_rejected、rate_limitの急増を通知してください。
Sentryではthrottle_unavailableの通知ルールを作成してください。ログへトークン・IP・メール・本文は保存しません。
通知先と閾値、Clerkのパスワード失敗ロック・必須認証タスク、Cloudflare AccessのMFA・WAFは実環境で確認します。
実装方針、制限値、依存パッチの残る監査指摘は[ADR 023](adr/023-security-boundaries-and-resource-limits.md)を参照してください。

一覧のカーソル用索引は生成マイグレーション0018で追加します。既存DBでは適用後にAPIと画面を同じ版へ更新してください。
