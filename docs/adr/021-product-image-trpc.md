# ADR 021: 商品画像の通信をtRPCへ統一する

## ステータス

採用。認可は[ADR 018](018-url-independent-procedure-authorization.md)、配置は
[ADR 004](004-server-layer-first.md)、画像の保持・清掃は[ADR 012](012-product-image-lifecycle.md)に従います。

## 背景

商品一覧・更新・画像を同じ型付きクライアントから呼び、商品領域の通信・認可宣言・
エラー処理と型契約を共通の入口で扱います。

tRPC 11はFormData入力を扱えます。一方、画像のJSON応答にはbase64の転送量とメモリー負担があり、
アップロードの本文を認可前に解析すると認可に失敗する要求でも大きな本文を読むことになります。容量と解析順序を明示します。

## 決定

### 公開契約

すべて`/api/trpc`の`product`ルーターで公開し、全体は31 RPC、画像専用HTTP操作は0件とします。

| 手続き                 | 種類     | 入力                                                       | 対象・結果                                          |
| ---------------------- | -------- | ---------------------------------------------------------- | --------------------------------------------------- |
| `product.getImage`     | query    | JSON `{ id, service: "customer" \| "business", imageId? }` | 個別または代表画像の`{ base64, contentType, etag }` |
| `product.addImage`     | mutation | FormDataの`id`と`file`                                     | 既存画像を保持して追加                              |
| `product.replaceImage` | mutation | FormDataの`id`と`file`                                     | 代表画像を差し替え、他の有効画像は保持              |
| `product.deleteImage`  | mutation | JSON `{ id, imageId? }`                                    | 個別または代表画像の参照を解除                      |

`id`は商品ID、`imageId`はその商品に属する画像IDです。取得・削除で`imageId`を省略すると現在の代表画像を対象にします。
追加・差し替え・削除は企業会員に固定し、入力からサービスや権限を変更させません。
旧`/api/products/:id/image`・`/api/products/:id/images`配下の全画像操作は404にします。
旧サービス別画像パスも復活させず、HTTP画像応答やリダイレクトの互換経路は残しません。

### 会員・権限・業務の境界

本人確認はHonoで1リクエストにつき一度行います。画像の各手続きは他のRPCと同じ`procedure`から始め、
`requireActor(...)`、`requirePermissions(...)`、入力検証、処理本体を直接並べます。
取得は顧客・企業会員の`product.read`、更新は企業会員の`product.read`と`product.update`を要求します。
ガードを別名のprocedureや接続ラッパーへ隠しません。

アップロードは固定の`requireActor("business")`と現在権限の検査を通過してからFormDataを解析します。
会員選択のためにmultipart本文を読む必要はありません。未認証・会員不一致・権限不足では本文や画像Storageを読みません。
取得・削除も、認可後に対象テナントの商品と有効な画像参照をユースケースで検証します。

通常のAuthorizedActorを既存のUseCaseへ渡し、domain・applicationへtRPCやHonoを持ち込みません。
追加時の既存画像保持、代表画像の楽観ロック、個別削除の再送、7日間以上の保持、D1とR2の補償・清掃は変えません。
DB結果が不明な失敗でもR2画像をその場で削除せず、一覧の再取得で確認します。

### アップロードの容量制限

- 画像本体はapplicationの既存上限5MiBとし、実際の`File.size`、形式・署名を検証します。
- tRPCのリクエスト本文は6MiB以下に制限します。multipartでは境界文字列・項目などを含む全体が対象です。
  tRPC入口の遅延ストリームで実バイト数を数え、JSON本文にも同じ総量制限を適用します。
- `Content-Length`がなくても、実際より小さく申告されても、読み出したバイト数が上限を超えたら停止します。
  ヘッダーだけを容量の根拠にせず、FormData解析後のファイル容量検証も省略しません。
- ストリームを入口で包むだけでは本文を読みません。認可後の入力解析が読み出す時点で制限を適用します。
  全文の先読みや、全multipartを重複して保持する独自パーサーは追加しません。
- multipart全体または画像本体の超過はtRPCの`PAYLOAD_TOO_LARGE`と日本語文言で返します。
  単独呼び出しのHTTPステータスは413です。不正入力・認証・権限・競合・内部障害も既存のtRPC変換を使います。

Honoの標準`bodyLimit`の導入版4.13.8では、Content-Lengthがなく実測する経路は`next()`より前に
本文を読み切り、Content-LengthがありTransfer-Encodingがない経路は申告値だけで次へ進みます。
tRPC入口への単純な追加では「手続きの権限検査前に本文を読まない」と「過少申告でも実サイズを制限する」を
同時に満たせないため、遅延ストリームで制限します。画像本体の業務制約はapplicationが担当します。

### 取得応答とクライアント

認可・対象照合後にStorageの画像を5MiBの上限付きで読み、base64へ変換します。
base64は元のバイト列の約4/3で、5MiBの画像ならJSONのその他の項目を除いても約6.67MiBになります。
サーバーとブラウザーで画像のバイト列・文字列を扱うため、バイナリを直接ストリーム配信する場合より
転送量とメモリー使用量は増えます。この上限付きのサンプルでは統一を優先します。

getImageは1画像ずつ単独で呼び、複数画像をtRPCバッチの一つの応答へ集積させません。
サーバーでも`standalone`メタデータを既存のContext生成で確認し、getImageを含む複数手続きの要求は
「この操作は単独で実行してください」で全体を拒否します。クライアントの分岐だけに依存しません。
画像を返す応答は`Cache-Control: private, no-store`と`X-Content-Type-Options: nosniff`を維持します。
`etag`はJSON内の情報として返し、条件付き要求や304によって認可を省略する経路は設けません。

型付きブラウザークライアントはFormDataとgetImageを単独の`httpLink`へ分け、通常のJSON操作は
既存のバッチ経路を使います。ライフサイクル手続きの単独呼び出しも維持します。
FormDataのContent-Typeとboundaryは通信ライブラリ・ブラウザーに任せ、JSON用ヘッダーを強制しません。

画像取得のbase64をBlobへ復元し、表示時にobject URLを作ります。差し替え・アンマウント時はURLを解放します。
本人・サービス・企業・会員の切替時には画像のクエリーと表示も分離し、遅れて完了した旧スコープの結果を戻しません。
追加・差し替え・削除は型付きmutationと既存のキャッシュ更新を使い、途中失敗の表示と無条件に再送しない方針を保ちます。

## 選択肢

- バイナリHTTP配信：転送量を抑えられますが、型付きクライアントとは別の通信契約が必要になります。
- base64も入力へ使う：送信時にも約4/3へ増えるため、標準対応のFormDataを使います。
- サイズ無制限のJSON取得・画像のバッチ化：応答とメモリーが集積するため採用しません。
- Hono bodyLimitをtRPC入口へ単純に追加：導入版では上記の本文読込み順・実測条件を満たせないため採用しません。
- FormData入力と上限付きJSON取得をtRPCへ統一：容量・認可順序・単独呼び出しを明示したうえで採用します。

## 影響

API・画面・公開型契約は互換性のある版を使います。外部クライアントも上記のtRPC契約に従います。
画像のR2キー・画像ID、会員認証、保持期間はそれぞれの担当レイヤーで管理します。
既存環境の未適用DBマイグレーションや画像保持の運用要件は[配備手順](../cloudflare.md)に従います。

受け入れ条件は[商品画像のユースケース](../project/use-cases/manage-product-images.md)に記録します。
[検証ガイド](../project/verification.md)に従い、実行結果と未確認の範囲を完了報告やPRに記録します。

## 参考資料

- [tRPC: Non-JSON Content Types](https://trpc.io/docs/server/non-json-content-types)
- [Hono: Body Limit Middleware](https://hono.dev/docs/middleware/builtin/body-limit)
- 導入版の実装確認：Hono 4.13.8の`dist/middleware/body-limit/index.js`。依存更新時は挙動を再確認します。
