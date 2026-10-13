# ADR 003: 軽量Feature-Sliced Design

## ステータス

採用。サービスごとの配置と共有範囲は[ADR 017](017-frontend-feature-ownership.md)で明確化。

## 決定

クライアントレイヤーとして`_app`・`widgets`・`features`・`entities`・`shared`を使用します。
TanStack Startの`app`ファイルは薄く保ち、ウィジェットを組み立てます。スライスをまたぐインポートでは、
公開`index.ts` APIと所有元の内部エイリアスを使用します。共有クライアントは`#client/*`、
アプリ固有のsrcは`#web/*`・`#business/*`・`#admin/*`です。アプリから共有コードを使う場合は
`@dev-template/client`の公開入口を使い、アプリ間や共有パッケージからアプリへの直接参照はしません。
FSDは配置先ごとに責務を整理する規則であり、すべての業務UIを共有パッケージへ集める規則ではありません。

サーバー側のDDDレイヤーは、クライアント側のFSD階層に含めません。

### クライアントの型はtRPCのAPI契約から導出する

内部モデルと画面の型を分離するため、API契約を境界として型を導出します。

生成済み`packages/api-types/index.d.ts`の`AppRouter`を利用し、tRPCの`inferRouterInputs`・
`inferRouterOutputs`から`RouterInputs`・`RouterOutputs`を公開します。
サーバーのルーター型への直接参照はこのファイルに集約し、通信基盤もここを経由します。
クライアントからdomain・application・infrastructureの型を直接参照・再公開しません。

業務固有の型はentitiesなどで導出し、スライスの公開`index.ts`を通じて利用します。
注文フォームの明細型は`RouterInputs["order"]["create"]["lines"][number]`、
注文一覧の型は`RouterOutputs["order"]["list"][number]`から導出します。
UI専用の状態は、必要に応じてこれらの型を加工して表現します。

現在はTypeScriptとtRPCでAPI契約を共有できるため、OpenAPIの仕様公開・型生成は追加しません。
別言語のクライアントや外部向けAPIが必要になった場合は、OpenAPIを改めて検討します。

この方針はクライアントの参照先を定めます。APIの出力から内部フィールドを除くなどの
DTO設計は別途サーバーのpresentationで行い、型導出だけで公開データが制限されるとは扱いません。

### entitiesのmodel・api・uiを実装例に使う

テンプレートでは、注文（`packages/client/src`）と商品（`apps/business/src`）に`model`・`api`・`ui`のセグメントを用意します。
各責務を次の場所に配置します。

| セグメント・レイヤー | 注文の例                         | 商品の例                                     |
| -------------------- | -------------------------------- | -------------------------------------------- |
| entities/model       | 注文型・非同期決済の表示判定     | 商品型・代表画像と追加画像の選択             |
| entities/api         | 注文一覧の取得・キャッシュ更新   | 商品一覧・認証付き画像の取得・キャッシュ更新 |
| entities/ui          | 注文明細・合計・状態の表示       | 商品カード・画像の表示                       |
| features             | 注文作成と一覧の更新             | 商品登録、画像アップロード・削除と一覧の更新 |
| widgets              | 注文フォームと注文一覧の組み立て | 登録フォームと商品カード・画像編集の組み立て |

modelはAPI応答の業務データ解釈と必要な表示用変換を所有し、uiはその結果を描画します。
注文の決済表示は `entities/order/model/payment-label.ts`、商品の代表画像の選択は
`entities/product/model/product-images.ts` に置きます。modelの計算はReact・取得処理から独立して検証できます。

画像編集の容量・形式・追加枚数の入力検証はfeatureの `model/image-change.ts`、
ロール編集の入力スキーマ・プラン外の既存権限を含めた候補の組み立てはfeatureの `model/role-editor.ts` に置きます。
画面固有の検索・並び替え・選択はwidgets側のmodelやhookが所有し、entitiesへ画面都合を持ち込みません。
UIは描画・イベント接続・開閉・入力などのUI状態を扱います。単純な金額整形や描画のmapはUIに残せます。
API応答をそのまま表示できる場合は変換層を作らず、サーバーの集約や認可・業務制約を複製しません。
フロントの判定は表示・入力補助専用で、サーバー側の検証も維持します。

注文の状態・サービスに応じた操作候補と編集スキーマは `features/manage-order/model` が所有します。
メンバー画面の招待選択肢・編集対象は `widgets/access-console/model/role-choices.ts` が
entitiesのサービス別ロール判定を使って組み立てます。取得拒否後の古い一覧はUI側で除外したうえで渡します。
web固有の顧客登録mutationとサービス別キャッシュの更新は
`apps/web/src/features/register-customer/api/use-register-customer.ts` に置き、登録UIから呼び出します。

entitiesの表示部品はfeaturesをインポートしません。商品カードはchildrenで操作UIを受け取り、
widgetが画像編集featureを渡します。画像は認証付きの`product.getImage`からJSONを取得し、
base64をBlobへ変換して表示します。画像キーが変わったら再取得し、
Blob URLは表示部品が差し替え・アンマウント時に解放します。

外部からは各スライスの公開`index.ts`を使用します。共通の通信基盤は`shared/api`に保ち、
業務固有のクエリや表示を置きません。新しい業務領域も、必要なセグメントに責務を配置し、
使わないディレクトリは作りません。

## 影響

- クライアントが成長しても、機能の所有範囲と依存方向を把握できます。
- レイヤー数を抑えることで、小規模アプリケーションに完全なFSDを適用する過剰な手続きを
  避けられます。
- 公開APIを意識的に保守する必要があります。

### フォームの入力管理と検証

登録・編集フォームはReact Hook Form＋Zodを使います。
useForm＋zodResolverが入力と項目エラーを管理し、注文の可変明細はuseFieldArrayを使います。
商品登録のスキーマはapps/business/src/features/create-product/model、作成・編集で共有する注文明細のスキーマは
packages/client/src/entities/order/modelに置き、公開index.tsから使います。フォームUIはshadcn/uiのForm・FormField・FormItem・FormLabel・FormControl・FormMessageをpackages/ui/srcに配置して使います。
公式new-yorkレジストリの実装を取り込み、参照パス・色を既存UIに合わせ、FormMessageにはrole=alertを付けます。

FormFieldのControllerが入力を管理し、数値入力のonChangeはevent.target.valueAsNumberで変換して、空欄や非整数・範囲外をZodで拒否します。Number("")で空欄を0にしません。
SKU・商品名の空白を整え、注文の重複SKUは各明細にエラーを表示します。フォームはnoValidateで
ブラウザー独自の文言を避け、Zodの日本語エラーを表示します。requiredやmin等の入力属性も維持します。

入力管理はReact Hook Form、送信・通信エラー・キャッシュ更新はtRPC＋TanStack QueryのuseMutationが担当します。
useActionStateは追加せず、既存のmutation経路を維持します。非同期送信はmutateAsyncを待ち、送信中の編集と重複送信を抑えます。
商品登録は成功した時だけSKU・商品名を初期化し、失敗時は入力を保持します。明細編集は成功した時だけ閉じます。
FormItemがIDを生成し、FormLabel・FormControl・FormMessageがラベルと項目エラーを入力に関連付けます。
各フォームでIDやaria-invalid・aria-describedbyを手動で重複管理しません。数値のNaNは入力上では空欄を表示します。

クライアント検証は入力補助です。API入力検証とサーバーのValue Object・Entityの業務検証を省略しません。
クライアントにサーバーのブランド型は持ち込まず、送信データはtRPCから導出した型に従います。

### shadcn/uiの汎用コンポーネントを優先する

汎用UIは[shadcn/ui公式レジストリ](https://ui.shadcn.com/docs/components)のコンポーネントを優先して使います。
new-yorkレジストリのButton・Input・Label・Checkbox・Card・Badge・Alert・Formをpackages/ui/srcに配置します。
Button・Input・Cardも公式実装を基にし、色・サイズは画面に合わせます。
追加時はcomponents.jsonのエイリアスに従い、画面ごとに汎用部品を複製しません。業務固有の表示や操作はFSDの各レイヤーで組み合わせます。

フォームではFormLabelがLabelを使い、画像選択もLabelとInput、下書きはCheckboxを使います。
注文状態・件数はBadge、通信エラーはAlertとAlertDescription、遷移リンクはButtonのasChildで表示します。
見出し・段落・一覧などの意味を持つHTMLは維持し、送信ボタン・リンク・チェックボックスの役割とキーボード操作を保ちます。

### ライト・ダーク・システムテーマ

shadcn/uiのセマンティックなCSS変数をpackages/ui/styles.cssで定義し、Tailwindの@theme inlineで背景・文字・カード・
ポップオーバー・入力・境界線・フォーカス・エラー色に接続します。darkバリアントはhtmlの.darkクラスに従います。
各画面も同じトークンを使い、装飾用のヒーロー配色とサービスアイコンにも両モードの配色を用意します。

_appのAppProvidersでnext-themesを使います。初期設定はsystemで、OSのprefers-color-schemeの変更に追従します。
features/switch-themeのThemeMenuを3画面で使い、shadcn/ui DropdownMenuのラジオ項目でlight・dark・systemを選びます。
手動設定はlocalStorageのdev-template-themeに保存し、画面移動・再読み込み後も維持します。
テーマは認証・API・業務データに影響しないクライアントの表示設定です。

next-themesの初期化スクリプトが描画前にhtmlのクラスとcolor-schemeを更新し、初期描画時のちらつきを抑えます。
サーバーは利用者のlocalStorageやOS設定を取得できないため、htmlに限りsuppressHydrationWarningを指定します。
この属性は上記の意図したhtml属性差に対応します。子の画面やフォームのハイドレーションは通常どおり検証します。
テーマボタンはSSRでも同じラベルとアイコンを描画し、未確定のテーマから画面内容を分岐させません。

E2Eで両モードの実際の背景色・フォームエラー・メニュー、文字のコントラスト（4.5以上）、キーボード選択、
移動・再読み込み後の保持、システム設定へ戻した後のOS追従を確認します。

### 数値・設定に意味を付け、所有層で管理する

入力制約はクライアントのshared/config/input-limitsにまとめ、Zod・HTML属性・日本語文言から同じ値を参照します。
画像容量・形式はapps/business/src/entities/product/model、フォームのデモ初期値とテーマ設定は各featureのmodel、
クエリのキャッシュ時間・再試行回数は_appの設定に置きます。保存キーもテーマ設定から参照します。
サーバーの業務上限はValue Object・Entityの名前付き定数が所有し、API入力検証もそれを参照します。

クライアントへサーバーのドメイン実装を持ち込まない方針を維持し、共通の契約テストで入力補助との一致を確認します。
E2EのQueue待機・ポーリングには単位付きの定数、コントラストにはWCAG・sRGBに基づく名前付き係数を使います。
定数の名前に責務・単位を含め、無関係な機能の設定を一つの巨大なconstantsファイルにまとめません。
