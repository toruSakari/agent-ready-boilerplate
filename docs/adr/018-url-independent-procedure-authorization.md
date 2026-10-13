# ADR 018: 共通RPCの手続きと会員で認可する

## ステータス

採用。[ADR 015](015-independent-service-accounts.md)・ADR 016の独立した会員登録・所属・退会と
共通Clerk本人確認を使い、商品画像も[ADR 021](021-product-image-trpc.md)のtRPC手続きで公開します。
手続きへの直接のガード宣言、本人確認・会員・現在権限の順序は画像のtRPC手続きにも適用します。

## 背景

画面やURLごとに認可チャネルを決めると、同じ本人・同じ操作でも呼び出す入口で許可が変わります。
画面は必要な共通APIを呼べるようにし、サービス会員・企業所属・操作権限の判定をサーバーへ集約します。
複数サービスに登録した本人でも、顧客としての注文所有と企業担当者としての権限は混ぜません。

## 決定

### 共通の入口と公開入力

RPCはすべて`/api/trpc`に統一します。web・business・adminのプロキシも同じAPIパスを転送します。
`/api/business/trpc`・`/api/admin/trpc`・`/api/customer/trpc`と不明な入口は404です。
旧URLへのリダイレクトやサービスの暗黙の既定値は設けません。

- `access.registration`・`access.session`・`access.withdraw`・`access.acceptInvitation`・`health`は
  `service: "customer" | "business" | "operator"`を必須入力にします。
- `access.members`・`access.roles`・`access.saveRole`・`access.invite`・`access.assignRole`・
  `access.removeMember`・`access.audit`は`service: "business" | "operator"`を必須入力にします。
- `access.organizations`・`access.users`・`access.createOrganization`・`access.updateOrganization`・
  `access.deleteUser`は手続きから運営会員を選びます。
- `access.registerCustomer`は通常会員、`product.create`は企業会員を手続きから選びます。
- 注文の照会・受注管理と`product.list`は`service: "customer" | "business"`を必須入力にします。
- `order.create`は`service: "customer"`だけを許可し、企業・運営指定は403です。企業の代理注文は内部ユースケースでも拒否します。
- 画像はADR 021の`product.getImage`・`addImage`・`replaceImage`・`deleteImage`を使います。
  getImageは`service: "customer" | "business"`を必須入力にし、更新・削除は企業会員に固定します。
  旧`/api/products`・`/api/customer/products`配下の画像HTTP入口は404です。

入力の`service`は「どのサービスの会員として操作したいか」という要求です。権限の証明ではありません。
招待の`actorKind`は引き続き招待先サービスであり、発行者が選ぶ`service`とは区別します。

### サーバーの認可

`application/auth/providers/account-identity-provider.ts`の`AccountIdentityProvider`が、本人確認ポート
`IdentityProvider`と照会ポート`AccessQuery`を受け取って会員解決・権限の方針を組み立てます。
D1のSQL照会とClerk・Cloudflareの具体的な検証はinfrastructureで実装し、Composition Rootで接続します。

認証したClerk subjectから、対象サービスの独立した有効な会員行を解決します。
次に対象企業の所属、操作パーミッション、必要な注文所有を検証します。画面のオリジン、URL、
ロールの自己申告、任意ヘッダー、`service`の値だけで権限を与えません。
`x-organization-id`は対象企業の選択に残し、そのサービス会員の所属を必ず確認します。

顧客指定の注文は顧客会員IDの本人所有に限定します。同じsubjectに企業会員・運営会員があっても
他人の注文、旧仕様で企業会員を所有者として保存した注文、出荷・完了の権限へ昇格しません。
運営専用操作は運営会員とplatform権限だけを使い、企業権限へフォールバックしません。
Cloudflare Accessはすべての運営操作で検証し、登録状態確認・セッション・招待承諾・退会・healthも例外にしません。

未登録の本人が利用できるのは対象の登録状態確認・招待承諾と通常会員の明示登録だけです。
読み取りやログインによる自動登録は行いません。本人退会は有効な対象会員を確認し、企業選択や
所属ロールを前提にせず実行します。最後のオーナー・運営管理者はユースケースで保護します。

### Honoで本人を確認し、手続きごとの会員・権限ガードから業務本体へ渡す

本人確認は`presentation/shared/middleware/authentication.ts`、共通の会員・権限ガードは
同じディレクトリの`trpc-authorization.ts`へ分けます。画像もこのtRPCガードを使います。
Access専用の`requireAccessScope`・`requireAccessPermissions`と入力契約は
`presentation/access/middleware/trpc-authorization.ts`で所有します。
`shared/trpc-core.ts`はtRPC初期化・Context生成・共通エラー変換を持つprocedureだけを公開し、
認可の再公開やルート登録ラッパーにはしません。

本人確認は保護対象のHTTPリクエストごとに一度行い、Hono Contextの`actor`へ本人確認済みのIdentity、
`container`へ依存の組み合わせを置きます。このactorは認証subjectと確認済みメールを表し、特定サービスの
有効な会員や操作権限をまだ意味しません。tRPC ContextはHonoから本人情報とcontainerを引き継ぎます。
認証失敗もtRPC側へ引き継いで既存のエラー形式へ変換し、非RPC用のJSON応答へ置き換えません。
公開の`/api/health`は本人確認を要求せず、廃止・未知の入口の404も維持します。

RPCの会員選択・権限検査はtRPCの各手続きへ組み合わせます。企業専用の商品操作は、例えば次のガードから
入力スキーマ・処理本体へ続けます。

```ts
procedure
  .use(requireActor("business"))
  .use(requireBusinessIp)
  .use(requirePermissions(["product.update"]));
```

`requireActor`はProcedure factoryではなく、`.use(...)`へ渡す独立したtRPCミドルウェアです。
各操作は`procedure`から始め、会員種別・必要権限をその場で宣言します。
`serviceProcedure`などの共通Procedureへ会員ガードを隠さず、入力スキーマと単体ミドルウェアだけを共有します。
通常の操作は会員ガード→権限ガード→入力検証→業務本体の順に接続します。
企業会員を扱う操作は[ADR 022](022-business-ip-restriction.md)の独立した `requireBusinessIp` を
会員ガードの直後に追加し、会員解決とネットワーク制限の責務を分けます。
登録状態確認・登録・招待承諾・退会も各操作へ`purpose`・空の権限要求・`standalone`を明示します。
RPCの`health`は既存どおり会員確認だけとし、業務データの取得や追加の権限照会を行いません。
共有操作では`requireActor(["customer", "business"])`のように許可する会員種別を宣言し、
入力の`service`を検証してその範囲内で選び、本人の対象会員をDBで確認します。
既知だが許可されない会員種別は403、不明・未指定のserviceは400にします。
固定した会員種別を入力の`service`で変更させません。続く`requirePermissions`は現在の会員・所属・
DB grantを検査し、プランとサービス別上限を適用した実効権限が要求をすべて満たす場合だけ次へ進みます。
古いactorのpermissionsを現在権限の根拠にせず、空の要求配列でも通常操作のサービス資格を確認します。

同じHTTPバッチ内では本人確認だけを共有し、選択したサービス会員は`next({ ctx: { actor } })`で
手続きごとのContextへ渡します。Honoのactorや共有Contextを選択会員で書き換えません。
運営操作のCloudflare Access検証は会員解決より前に行い、同じリクエスト内ではその検証結果だけを共有できます。
運営の拒否で、別手続きとして実行できる顧客・企業操作まで拒否しません。

本人・サービス会員の情報は認証プロバイダーが発行したものだけを通信境界で受け付けます。
先行するactorガードがない場合も安全側で拒否し、型定義だけでミドルウェアの実行を保証したことにはしません。
運営はplatform、企業担当者は選択した企業の所属で判定します。一般ユーザーは企業所属を持たず、有効な通常会員と本人の注文所有で判定します。URL、ヘッダー、入力オブジェクトから
会員情報や権限をそのまま作る経路は設けません。

`AuthorizedActor`はIdentityに`service`、実効`permissions`、プラン適用前の`rolePermissions`、
`protectedRole`、`platform`などを加えた通常のデータです。実行可否には実効権限を使い、
ロール編集・委任可能な範囲にはサービス上限で絞ったrolePermissionsを使います。
ユースケースはこのactorを引数に取る通常のasyncメソッドとし、HonoやtRPCのContextへ依存しません。
必要権限の宣言と検査を通信境界へ集約し、内部の業務処理やテストも同じactorのデータ契約を使います。
新しい呼び出し口を追加する場合は、その境界にも会員種別・現在権限の検査が必要です。

scopeを入力で選ぶAccess操作だけは、会員ガード→service・scopeの入力検証→`requireAccessScope`→
`requireAccessPermissions`の順に接続します。権限検査のための状態読み込み自体を対象企業へ限定する必要があるためです。
残りの操作入力は権限ガードの後で検証します。固定の運営scopeにはこの入力依存のガードは不要です。
Accessの`requireAccessPermissions`は対象scopeの状態を先に読み込み、現在権限を検査してから
actorの`accessSnapshot: { scope, state }`へ保持します。`accessState(actor, scope)`はその状態と
参照対象scopeの一致を確認します。
業務本体は保持されたスナップショットを使い、保存時も同じ`state.version`を比較します。
読み込み後の権限失効は認可で、認可後の競合は保存時の409で止めます。認可後に状態を読み直し、
新しい版で古い認可をコミットする順序にはしません。運営による会員削除の委譲先も同じ状態を使います。

対象企業・商品・本人注文の制約、最後のオーナー保護、割り当て可能なロールなどの業務ルールは残します。
招待承諾時の発行者の現在権限は、招待そのものがまだ有効かを判断する業務条件として確認します。
`product.getImage`には`product.read`、追加・差し替え・削除には`product.read`と`product.update`を要求します。
画像の各手続きにも`requireActor(...)`と`requirePermissions(...)`を直接並べ、会員種別と必要権限を
その場で読める形にします。接続済みガードを別名で共有しません。追加・差し替えは企業会員を固定し、
認可が済む前にアップロード本文を読みません。FormDataの解析と実バイト数制限の詳細はADR 021に従います。

登録状態確認・招待承諾・登録・退会はactorの`purpose`で用途を区別します。
通常の所属権限を一律に要求せず、本人と対象サービスを結び付け、企業ヘッダーで対象を変えません。
未登録の本人を通常操作の有効会員として扱わず、他サービスへも自動登録しません。
退会する対象会員の現在状態と本人の一致は業務本体で確認します。Queue・清掃などは別のシステム用ユースケースで扱い、
利用者向け操作にsystem権限の迂回経路を追加しません。

### 共通セッションとページの閲覧権限

画面内のQueryClientは、認証した本人・サービス・選択企業が同じ間は共有し、pathnameだけでは作り直しません。
登録状態の確認後に共通の`access.session`を取得し、ページやメニューは同じクエリー結果を参照します。
通常の画面遷移では招待プロバイダーも保護ツリーを再マウントしません。新しい招待フラグメントの
取り込み・URLからの除去と、認証前の安全な待機は維持します。

セッションの鮮度・定期再検証は30秒、確認成功から60秒を超えた保護UIは安全側で表示を止めます。
focus・reconnectと、下記の部分表示用読み取りを除く認可エラーでも再検証します。停止・通信断・未完了の要求で古い権限を無期限に
表示せず、必要なら保留中の要求を取り消して再試行します。通常操作の403だけでログアウトはしません。
登録状態やセッションそのものを再確認し、サービスの利用資格喪失と個別操作の権限不足を区別します。

本人・サービス・企業の切り替えではキャッシュを分離します。別タブでの退会・再登録などにより
同じ本人の会員IDが変わった場合も、旧会員の業務データを破棄します。登録状態とセッションの会員IDが
一致するまでは保護UIを表示しません。権限変更時や会員・所属・招待・退会の更新では、古い取得を
取り消し、関連キャッシュを失効させます。遅れて完了した要求から旧会員や旧権限のデータを戻しません。

ルートの`PermissionGate`、メニュー・操作ボタンの権限ガード、個人情報のマスキングは維持します。
要求配列は既定で全件必須で、独立した表示先のいずれかを許可する場合だけ明示的にANYを使えます。
企業権限と運営platform権限は相互に代用しません。

ページ内の注文・商品・運営の企業一覧／利用者一覧など、独立したデータセクションは`can(...)`で
取得前に除外せず、APIを呼び出して各手続きの結果で表示します。`FORBIDDEN`ならそのセクションと
取得済みデータの表示を止め、取得できる隣のセクションは残します。HTTPバッチが207でも各手続きの
エラーコードを見ます。500・通信失敗は権限不足として隠さず、エラーを表示します。

この部分表示用の読み取りには`perQueryAccessOptions`を指定します。403が確定したクエリーは
自動再取得を止め、`forbiddenBehavior: "hide-section"`により全体のセッション再取得ループを起こしません。
セッションの権限変更などでクエリーを明示的にresetした場合は再取得できます。
操作の403と、この指定がないクエリーの403は引き続きセッションを再検証します。401の処理は変えません。
登録状態・セッション自体の拒否は、部分表示ではなく保護データの破棄と入場判定へ反映します。

`user.personal.read`が失効した場合は、既取得のメールも表示・検索に使いません。
ページ本文や一つのセクションが拒否されても、利用できる別ページへのメニュー・企業選択・本人の会員操作は残します。
これらは表示制御であり、APIの通信境界での現在権限検査とユースケースの業務制約を代替しません。

### StartのWorkerとルートlayout

[ADR 019](019-frontend-request-authentication.md)に従い、各appのroute groupとlayoutで本人確認・
サービス資格の表示条件を明示します。Root Providersは公開パスを判定せず、ProxyはClerkのCookieと
ハンドシェイクだけを同期します。layoutはAPIの認可境界を代替しません。
会員・所属・操作権限は引き続きAPIで毎回確認します。

### バッチ

登録状態確認・招待承諾・通常会員登録・退会のライフサイクル手続きは単独で呼び出します。
登録状態確認を含め、これらの手続きが他の呼び出しと混在したバッチは全体を拒否します。
サーバーはルーターの手続きメタデータから判定し、一部の手続きだけを実行しません。
クライアントもライフサイクル手続きに単独の通信経路を使い、通常の読み取りバッチと混ぜません。
ADR 021の商品画像取得も単独で呼び、複数の大きな画像JSONが一つの応答へ集積することを防ぎます。
FormDataのアップロードも非JSON入力に対応する単独の通信経路を使います。

## 選択肢

- サービス別URLを維持：同じ操作が入口に依存し、画面間の再利用を妨げるため不採用
- 共通URLのサービス指定をそのまま権限として信頼：未登録サービスや他企業へ昇格できるため不採用
- 共通URLと明示入力を使い、各手続きがサーバー上の会員・所属・権限を検証：採用

## 影響と検証

API・3画面・型契約`@dev-template/api-types`は整合する版で利用します。
service必須入力を省略した呼び出しや、ライフサイクルの混在バッチは受理しません。
会員データの準備はADR 015と配備手順に従い、未適用のSQL移行や対応表の確認を省略しません。

検証では共通APIへの直接呼び出しと各画面のプロキシで同じ認可結果を確認します。
未登録・権限不足・他企業・退会済み会員・顧客の本人注文制限、運営Access保護、
混在バッチの全体拒否、旧入口の404を回帰条件にします。
