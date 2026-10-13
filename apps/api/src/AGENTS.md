# サーバーの作業ルール

DDD・FSD・公開境界・検証の規約は業務を問わず適用する。以下の具体的なサービス名・会員区分・
商品／注文／在庫・企業所属は現行サンプルの仕様で、新規業務の必須要件ではない。
別業務への初期適用は`docs/project-guide.md`の「別ドメインへの初期適用」に従う。
現行サンプルの操作を残す間は、その認可・tenant分離・整合性・ログ保護を維持する。

ルートのルールに加えて適用する。`docs/adr/001-application-architecture.md`と
配置の方針を定めた`docs/adr/004-server-layer-first.md`を読む。
整合性を変更する場合は対象の保存・競合・再実行の契約と関連ADRを読む。
現行サンプルの注文処理では`docs/adr/002-order-consistency.md`も読む。
現行サンプルの認証・認可を変更する場合は`docs/adr/018-url-independent-procedure-authorization.md`も読む。

- `apps/api/src/{domain,application,infrastructure,presentation}/<業務領域>/`に配置する。
  applicationの業務領域内はガイドの配置表に従い、業務操作・認証・認可・型・検証・変換を役割ごとに分ける。外部認証アダプターは`infrastructure/auth/providers`に置く。
- `domain/<業務領域>/entities`にEntity、`value-objects`にValue Object、`repositories`に集約Repositoryのインターフェースを置く。
  業務方針・カタログ・列挙コードは`policies`、ドメインエラーは`errors`に置く。複合データを`value-objects`へ置かない。
  ドメインイベントは`events`、複数領域で共有する単純な値は`domain/shared/value-objects`に置き、テストは対象と同じディレクトリに置く。
- Entityは所有ファイルに対応するクラスで実装し、1ファイル1クラスとする。オブジェクト型・関数群をEntityの代用にしない。ドメインエラーは各業務領域の`errors`に置く。Snapshot・復元入力・状態別の共用型はクラスに付随する補助型として扱う。
- 業務上限は対象のValue Object・Entityが名前付き定数で所有し、presentationの入力検証でも参照する。
  容量・処理件数はapplication、通信処理の定数は該当アダプターに置き、クライアントの設定には依存しない。
- `domain`は不変条件・状態遷移を扱い、DB・HTTP・Cloudflare・UIに依存しない。
- Value Objectは1ファイル1VO、DTOは1ファイル1DTOとし、入力・出力も別ファイルに置く。スキーマ・型・生成処理は同じ定義の一組として保持し、複数のブランドを同じファイルへまとめない。共有する未ブランドのスキーマ・制約は再定義せず定義元から参照する。
- Value Objectは一つの値だけを持つZodブランド型と検証付きcreateで表す。複数の値をまとめた設定や値同士の整合性はEntityが所有し、Value Objectをクラスで実装しない。`project/single-value-object`が配置・ブランド型・複合スキーマの混入を検査する。
  スキーマ定義 → `.brand<"型名">()` → `z.infer<typeof schema>` → `parse`／`safeParse`による値の生成、の順に実装する。`z.output`は`z.infer`と同じ出力型として利用できる。
  内容が妥当なプリミティブ値でも、検証前の直接代入は型エラーになる契約を保つ。createはブランド付きの検証成功結果を返す。
  エンティティは検証済みの値を受け取り保持し、通常の作成・値変更で値自体を再検証しない。
  数量は注文・現在庫・予約など業務上の用途で分ける。入力時・復元時に作成し、API・DB・イベントへの出力時だけプリミティブ値へ変換する。ブランドを型アサーションで付けず、演算結果はcreateで再検証する。DTO型はプリミティブを明示し、詳細はADR 009。
- 状態別の共用型は業務名（`Order`など）、実装クラスは`OrderEntity<S>`のように命名し、共用型にAny接頭辞を付けない。
- 状態を持つエンティティはTypestateと幽霊型で操作の遷移元・遷移先を表し、具体的な操作メソッドを使う。
  Repository・永続化アダプターでunknownの保存データの形式・状態・日時を検証し、Value Objectを作る。
  エンティティのrestoreはブランド型を持つ復元入力を受け取り、集約の整合性を確認する。状態別の共用型をstatusで絞ってから操作する。
  実行時ガードも維持し、型アサーションや汎用transitionで禁止操作を迂回しない。詳細はADR 008を参照する。
- 集約Repositoryの契約は`domain/<業務領域>/repositories`に置き、ユースケースとインフラストラクチャが直接参照する。
  Gateway・画像Storage・独立した監査追記Store・Outbox配信の契約は`application`に置く。
- 集約Repositoryはエンティティを受け取り、取得時も検証・復元済みエンティティを返す。ユースケースで保存データをrestoreしない。
  保存入力はEntity、取得結果は復元済みEntity（未検出はnull）とし、先にinterfaceの契約を定義してから実装を合わせる。保存のvoid・競合判定のboolean、テナント・ID・期待版などの条件はEntityへ包まない。
  一覧もRepositoryが復元済みEntity配列・Entity群を返し、UseCaseとapplicationの変換処理が表示用DTOを作る。集計もEntityを受け取りapplicationで数える。件数DTOをEntityと名付けて包まない。UseCaseへQueryポートを注入しない。
  Repository実装にQuery・R2実体操作・清掃・独立した監査追記を兼務させない。画像の回収用stageと清掃はstorage、独立した監査追記はstores、Outbox配信はmessagingへ置き、Composition Rootで別々に注入する。
  Entityを保存する契約・実装はRepositoryへ置き、Storeへ別のEntity保存経路を作らない。入力がSnapshotやDTOでもEntityの状態・関連を変えるなら同じ規約を適用する。
  商品画像の追加・差し替え・解除はProductの操作で変更し、ProductRepositoryが画像の有効化・退役と代表参照を原子保存する。
  商品登録はProductRepository.registerの限定的な複合初期化とし、在庫側の初期INSERTはinventory/sharedで組み立てて同じbatchで保存する。
  通常の在庫調整はInventoryRepository.saveAdjustmentへ変更後のInventoryItemとStockAdjustmentEntryを渡す。
  Entityの変更とOutbox・変更監査の原子保存はRepository内に残す。Accessの版付き読取は復元済みEntity群を返し、保存変更はEntity群と削除ID・期待版からなる。取得DTOをEntityの代わりに使わない。
  RepositoryからQuery・Storage・Store・Messagingのポートや実装へ依存しない。共通のDB選択・組み立ては当該領域のsharedへ置き、個別アダプターから独立させる。
  取得・保存はRepository本体のメソッドにまとめ、操作ごとの委譲ファイルを作らない。複雑なSQL組み立てを分離する場合は当該領域のsharedへ操作名で配置し、queryという名前を付けない。画像実体・stage・清掃の結合テストはstorage、商品の画像関連を保存するテストはrepositoriesへ置く。`project/repository-responsibilities`で本番の依存と配置を検査する。
  型契約テストでEntity入出力とRepository実装の公開メソッドを固定し、DTO返却や他ポートの兼務への退行を防ぐ。
- `application/<業務領域>/use-cases`にUseCaseクラス・テストを置き、`dtos`に入力・出力データ型を置く。
  UseCaseの公開操作は入力DTOを受け取り、出力DTOを返す。認可済みactor・ID・フィルター・ページ条件は入力DTOにまとめる。単純な成功結果も出力DTOで表し、Entityや生のプリミティブを公開操作の返却契約にしない。非同期の返却型はPromise<出力DTO>とする。
  出力DTOの型名には`Dto`を付け、Entity・保存スナップショットと区別する。
  入力は`*InputDto`、出力は`*OutputDto`をdtosから参照し、公開操作の引数・返却型へ明示する。引数が不要なバックグラウンド操作も空の入力DTOを受け取る。一覧はitemsを持つ出力DTO、完了だけの操作はokを持つ出力DTOで返す。Controllerは出力DTOから公開APIの応答を組み立てる。`project/repository-responsibilities`で公開操作のDTO契約とQuery依存を検査する。
  dtosで公開するデータ型はZodスキーマをDTO名でbrand化し、z.infer／z.outputから導出する。同じ形の別操作には別のブランドを付け、同じ操作の委譲用別名はスキーマ・型を再公開する。複合DTOをValue Objectとは扱わず、内部の値はプリミティブのままにする。スキーマは所有する領域に置き、既存の定数・検証・スキーマを参照・合成する。
  ControllerはparseInputDtoで入力を検証し、Queue・Gateway・UseCase間の呼出し元も入力スキーマを通す。UseCaseは戻す値を出力スキーマで検証する。入力不正は400、出力不正は内部障害として扱う。型アサーション・常に成功する検証でブランドを付けず、project/branded-dtoで型の定義を検査する。
  認可済みactorのEntity群・更新番号は元の参照を保持して検査する。ストリーム・バイナリーは対応する実体を検査し、JSONへ変換しない。HTTP・tRPCの公開型には内部のDTOブランドを要求せず、受信側の検証は別の境界で行う。
  UseCaseへHTTPのRequest・フレームワークのContextを渡さない。
  実装は`create-order-use-case.ts`、テストは`create-order-use-case.test.ts`のように命名する。
  永続化の一覧取得もdomainの`repositories`を使う。外部依存の契約は用途で分け、外部処理は`gateways`、画像保存は`storage`、独立した監査追記は`stores`、イベント配信は`messaging`に置く。
  UseCaseごとの専用インターフェースや同じメソッドを写した型は作らず、実装クラスを直接使う。
  Repositoryや外部依存・コンテキスト境界の契約は維持し、UseCaseへコンストラクターで渡す。
  認証のIdentityは`application/auth/contracts/identity.ts`、IdentityProviderは`application/auth/providers/identity-provider.ts`に置く。
  通信境界の会員解決・現在権限の方針は`application/auth/providers/account-identity-provider.ts`がIdentityProvider・AccessQueryを使って組み立てる。通信境界専用の認可QueryはUseCaseへ渡さず、会員UseCaseはAccessReadRepositoryのEntityから業務判断する。
  SQL照会やClerk・Cloudflareの検証はinfrastructureに残し、applicationから具体的アダプターへ依存しない。
- `application`は認可とユースケースを組み立て、外部処理はポートを通す。tRPC・Hono・Cloudflareなどのフレームワークへ依存しない。
  本人確認済みactorをHono Contextへ置き、商品画像を含む各tRPC手続きで会員種別、現在権限の順に検査する。
  汎用認可には`application/auth`の共通処理を使い、RPCのactorは手続きごとのContextへ渡して混在バッチで共有しない。
  UseCaseは認可済みのactorデータを受け取り、対象データの所有・状態などの業務制約を担う。
  フレームワークのContextには依存しない。
  Accessの変更は認可前に読んだ状態をactorのスナップショットへ保持し、同じ版で保存する。
  既知の業務エラーは`application/shared/application-error.ts`で表し、presentationでtRPC・HTTPへ変換する。
  APIとQueueの呼び出し側はUseCaseクラスの型を使い、Composition Rootが依存を接続する。
  `ApplicationContainer`はUseCaseクラス・AccessRepository・ServiceIdentityProviderをまとめるDIの型であり、UseCaseごとの契約を重複定義しない。
- `infrastructure/<業務領域>`の中を役割で分ける。集約Repository実装は`repositories`、Gatewayは`gateways`、画像Storageは`storage`、台帳Storeは`stores`に置く。
  Queueの送受信は`messaging`、DOは`durable-objects`、認証プロバイダーは`providers`、DBスキーマは`schemas`、保存データの変換・復元は`mappers`に置く。
  在庫はdomainのInventoryRepositoryをD1DoInventoryRepositoryが実装し、D1台帳とDO予約を合わせたEntityの取得・保存を担当する。D1の行データはinfrastructure/inventory/sharedの内部部品に閉じ、DOは直列化とEntityの操作を担う。
  テストは対象と同じディレクトリに置き、実装のないディレクトリは追加しない。Drizzle設定とWorkerエントリーも新しい配置に合わせる。
- `infrastructure`はD1・R2・Queue・DOのアダプター、`presentation`は入出力の変換を担う。
- D1の通常のCRUD・JOIN・サブクエリ・upsertはDrizzleのスキーマとクエリビルダーを使う。SQL文字列で列名・CRUDを重複管理しない。
  採用するAPIは公式ドキュメントと利用中の版で確認する。sqlはビルダーで表現できない式・SQLite固有機能に限定し、値をパラメーター化して理由を残す。
  D1の原子保存はbatchで行い、期待版・テナント条件・Outbox・監査・失敗時のロールバックを維持する。保存値の検証とEntity復元をORMの型だけで省略しない。詳細はADR 034。
- `presentation/<業務領域>/trpc-router.ts`はその領域のRPCだけを定義する。
  全体の接続と公開型は`presentation/app-router.ts`、HTTPアプリの接続は`presentation/api-app.ts`に置く。
  商品画像の取得・追加・代表画像差し替え・削除も`product/trpc-router.ts`へ置き、画像専用HTTP入口は残さない。
  tRPCの共通基盤は`shared/trpc-core.ts`とし、共通の本人確認とtRPC認可は`shared/middleware/`に分ける。
  領域固有の認可は当該領域の`middleware/trpc-authorization.ts`へ置く。
  `trpc-core.ts`からミドルウェアを再公開せず、テストも対象と同名・同階層にする。
  会員種別・要求権限のガードは各RPC・HTTP操作に直接宣言し、接続済みガードの別名で隠さない。
  公開HTTPヘルスと会員確認だけを行うRPCヘルスの契約は維持する。
- 現行サンプルの画像追加・代表画像差し替えはFormDataの`id`と`file`を受け取り、固定の企業会員・権限ガードの後で解析する。
  multipart全体はtRPC入口の遅延ストリームで実バイト数を制限し、Content-Lengthの欠落・過少申告でも上限を守る。
  認可前の本文読込みは禁止し、解析後の実際のFile.sizeとapplicationの5MiB制約・形式検証も残す。
  画像取得は認可後に上限付きで読み、base64・contentType・etagのJSONを返す。画像取得をバッチへ含めず、
  private, no-storeとnosniffを維持する。etagや条件付き要求を理由に認可を省略しない。
- 依存の接続は`composition-root.ts`で行う。別コンテキストの集約は直接インポートしない。
- tenantを持つ操作はサーバーで確認した所属・所有関係から対象を決め、読取・更新の両方で限定する。
  現行サンプルの管理操作のtenantIdは、対象サービス・企業所属を確認したactorから取得する。
- 現行サンプルではD1が在庫台帳の正本。DOは企業・SKU単位の予約・直列化を担う。既存企業の名前空間・SKUキーを維持し、新規企業は別の名前空間へ分離する。変更時は期限切れと途中失敗も検証する。
- Outbox配信・Queue処理は再実行を想定し、イベントIDや割当IDで重複の影響を防ぐ。
- R2とD1をまたぐ変更には補償や残存ファイルの扱いを定める。
- APIは画面の言語に依存せず、HTTP・tRPCのコードと翻訳用の公開errorCodeを返す。具体的な復旧説明にはApplicationErrorの安定したreasonを定義し、内部情報を理由・引数へ載せない。安全な日本語文言は互換用として維持する。入力不備400、未認証401、権限不足403、未検出404、
  競合・在庫不足409、サイズ超過413を使い、予期しない障害は500とする。
  tRPCのコードとHTTPステータスの対応を保ち、内部例外の文言・スタックを応答へ載せない。
- 型エラーを抑制コメントで打ち消さない。禁止操作の型検証は型契約で行い、実行時ガードはテスト専用のJavaScript呼び出し境界で確認する。
- テストは対象と同じ階層に置き、不変条件、認可、失敗、該当する競合・再実行を確認する。
