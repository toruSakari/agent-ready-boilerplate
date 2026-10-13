# 共通クライアントの作業ルール

DDD・FSD・公開境界・検証の規約は業務を問わず適用する。以下の具体的なサービス名・会員区分・
商品／注文／在庫・企業所属は現行サンプルの仕様で、新規業務の必須要件ではない。
別業務への初期適用は`docs/project-guide.md`の「別ドメインへの初期適用」に従う。
現行サンプルの操作を残す間は、その認可・tenant分離・整合性・ログ保護を維持する。

このパッケージは複数サービスが実際に使うクライアントコードを所有する。
単一サービスの機能はapps/web・business・adminのsrcに置く。所有範囲はdocs/adr/017-frontend-feature-ownership.mdを参照する。
以下のFSDルールはクライアント側に適用する。サーバー側は末尾の案内に従う。

- クライアントは`_app`・`widgets`・`features`・`entities`・`shared`の軽量FSDに従う。
  詳細は`docs/adr/003-lightweight-fsd.md`を参照する。
- パッケージ内の参照は`#client/*`、スライス間のインポートは公開`index.ts`から行う。業務固有の機能を`shared`に置かない。
  アプリからは`@dev-template/client`の公開入口を使い、アプリの`#web/*`・`#business/*`・`#admin/*`を共通パッケージから参照しない。
  現行サンプルの商品管理・全体の企業／ユーザー管理・通常会員登録を公開入口へ戻さない。storyからだけ`#storybook/fixtures`を使える。
- `shared`は汎用UI・通信基盤・ユーティリティを担い、featuresやwidgetsに依存しない。
- `_app`は全体のプロバイダー、widgetsは画面のまとまり、featuresは利用者の操作、
  entitiesはクライアントの業務データ表現を担う。
- entitiesは`model`にAPIから導出する型、`api`に取得・クエリ・キャッシュ更新、
  `ui`に業務データの表示を置く。登録・更新・削除など利用者の操作はfeatures、
  データ取得・操作・表示の画面への組み合わせはwidgetsが担う。
  entitiesからfeaturesやwidgetsを参照せず、操作UIは必要に応じてchildrenで受け取る。
- パス検証・翻訳・取得表示・エラー復旧・業務データの解釈は、`docs/project-guide.md`の
  「動的パスの検証」「多言語の表示とAPI契約」「取得の読み込み表示」「フロントのエラーと復旧範囲」
  「業務データの解釈と表示」の該当節を読み、共通規約に従う。
- クライアントの業務データ表現とサーバー集約を混同しない。サーバーの実行コードをUIに取り込まない。
- クライアントのAPI入出力型は`packages/api-types/index.d.ts`の`RouterInputs`・`RouterOutputs`から導出する。
  サーバーの`domain`・`application`・`infrastructure`から型を直接参照・再公開しない。
  サーバーが生成する`@dev-template/api-types`を通信基盤も利用し、サーバー実装へ直接参照しない。
  業務固有の型は`entities/<業務領域>/model`などで導出し、公開`index.ts`から利用する。
- API契約はDTOのプリミティブ型を使い、サーバーの値クラスやブランド型をクライアントへ直接持ち込まない。
  フォーム編集中の値と検証済みの値を分け、クライアント検証があってもサーバーの検証を省略しない。
- 共有する入力上限はshared/config/input-limits、商品画像の容量・形式は所有アプリのapps/business/src/entities/product/modelで定義する。
  スキーマ・HTML属性・エラー文言で同じ定数を参照する。フォームの初期値・テーマ設定は各featureのmodel、キャッシュ設定は_appが所有する。
  サーバーのドメイン定数をクライアントへ直接インポートせず、APIの制約との一致はtestsの契約テストで確認する。
- 登録・編集フォームはReact Hook FormのuseFormとZodのzodResolverで入力と項目エラーを管理する。
  可変明細はuseFieldArrayを使い、編集中の数値の空欄を0へ変換しない。送信前に数値・文字列の形式と範囲を確認する。
  入力補助のZodスキーマはクライアントのmodelに置く。共有する明細スキーマはentitiesの公開APIから使い、サーバーのブランド型を持ち込まない。
  送信とキャッシュ更新はtRPC・TanStack QueryのuseMutationを使う。失敗時は入力を保持し、選択言語の項目エラーと公開コードから翻訳したサーバーエラーを表示する。
  項目UIはpackages/ui/src/formのshadcn/ui Form・FormField・FormItem・FormLabel・FormControl・FormMessageで統一する。
  FormControl・FormMessageがID・aria-invalid・aria-describedby・role=alertを管理する。送信中は編集と重複送信を抑える。
- 汎用UIはshadcn/uiの既存コンポーネントを優先する。新規作成前に公式レジストリとpackages/ui/srcを確認する。
  Button・Input・Label・Checkbox・Card・Badge・Alertなどのプリミティブはpackages/ui/srcに配置し、画面へ直接コピーしない。
  ラベルはLabel、フォーム項目はFormLabel、項目エラーはFormMessage、通信エラーはAlertを使う。リンクをボタンとして表示する場合はButtonのasChildを使う。
  公式コンポーネントの契約・アクセシビリティを保ち、色や余白は共通部品・classNameで調整する。業務固有のUIはFSDのentities・features・widgetsに置く。
- 配色はpackages/ui/styles.cssのshadcn/uiセマンティックトークン（background・foreground・card・muted・border・input・destructive等）を使う。
  固定のライト用色を画面に追加しない。装飾色を使う場合もダーク用の配色を用意する。
  テーマは_appのnext-themes Providerで管理し、切り替え操作はfeatures/switch-themeの公開APIを使う。
  ライト・ダークの両方で文字・入力・エラー・メニューの可読性、OS追従、手動設定の保持を確認する。
- 操作可能なラベル、エラー・処理中表示、キーボード操作を確認する。
- サーバーも変更する場合は`apps/api/src/AGENTS.md`を追加で読む。
