# ADR 026: i18nextと日本語原文キーによる多言語対応

## ステータス

採用。web・business・adminの表示文言を日本語・英語で用意する。

## 背景と理由

表示内容をコードから読めるよう、日本語原文を翻訳キーにし、日本語の辞書を持たない。
翻訳がない場合はキーそのものを表示できる[i18next](https://www.i18next.com/)を使う。
当初のParaglideの生成関数方式から置き換え、翻訳コンパイル・生成コード・外部プラグイン取得を不要にする。
原文を変更すると英語辞書のキーも変更が必要になることを受け入れる。

## 決定

### 配置・翻訳

`packages/client/src/shared/i18n/en.ts`だけに英語辞書を持つ。
`shared/i18n`の公開入口の`t("企業画面のIP制限")`で翻訳する。
日本語辞書は用意せず、未翻訳の英語も日本語原文へ戻す。
`keySeparator: false`と`nsSeparator: false`でドット・コロンを含む原文をそのまま使う。
`t("SKUは{{max}}文字以下です", { max: limit })`のように文章全体と名前付き引数を使い、断片を連結しない。
ラッパーは原文中の引数名を型検査する。英語辞書の引数名と原文の一致もテストする。
英語辞書はTypeScriptのソースとして配布し、生成やネットワーク取得を行わない。

Reactが文言をテキストとしてエスケープするため、i18nextのinterpolation.escapeValueはfalseにする。
翻訳結果をdangerouslySetInnerHTMLへ渡さない。商品名・企業名などの利用者データは翻訳しない。
同じ日本語原文は同じ意味のキーを共有する。意味が異なる場合は原文を明確に区別する。

### SSRと言語切替

表示言語は`dev-template-locale` Cookieで判定し、未設定・未対応値は日本語へ戻す。
URLには言語プレフィックスを追加しない。Cookieは表示設定のみで、認証・認可・企業選択に使わない。
各WorkerはAPIプロキシ・Clerk同期の後、Startを`i18nMiddleware`で包む。
要求ごとにi18nextインスタンスを同期初期化し、AsyncLocalStorageでSSR・非同期処理の言語を分離する。
ブラウザーの辞書も同期初期化し、初期描画の翻訳ロード待ちを発生させない。
Node専用モジュールは`@dev-template/client/i18n/server`だけから参照する。
HTMLのlang・dir、SSRの文言とブラウザーの言語を一致させ、応答はprivate, no-storeとする。

言語選択featureはCookieを更新してページを再読み込みする。未送信フォームはリセットされる。
再読み込みで全体を切り替えるためreact-i18nextのProvider・hookは導入せず、共通翻訳関数を使う。
再読み込みなしの切替を追加する際はReactとの購読連携も導入する。
Storybookだけは表示全体を管理するので、locale toolbarとreload:falseで比較する。
Clerkは公式のjaJP・enUSを同じ言語判定で選ぶ。

### FSDと表示時の言語

共有の翻訳基盤・英語辞書・Intl整形はshared/i18n、言語選択はfeatures/switch-languageへ置く。
状態・権限の表示変換はentities/model、操作固有の入力検証はfeatures/modelが所有する。
スキーマの検証時・ラベルの表示時に翻訳し、モジュール評価時に文言を固定しない。
金額は表示言語で通貨を変換せずJPY、日時はAsia/Tokyoを明示する。
フォーム・通知・読み込み・Error Boundary・画像代替・アクセシビリティも同じ翻訳基盤を使う。

### APIとの契約

APIへ画面の言語判定や翻訳ライブラリーを導入しない。
tRPCは標準の`data.code`とHTTPステータスに加えて、表示に使う`data.errorCode`を返す。
通常は標準コードと同じ値で、最後のオーナー保護・招待期限切れ・メール未確認は
ApplicationErrorの安定した`reason`を公開する。Zodの入力エラーはBAD_REQUEST、5xxはINTERNAL_SERVER_ERRORへまとめる。
Honoの公開APIエラーにも`code`を付ける。従来の安全な日本語message/errorは互換用として残す。
クライアントは共通の`errorMessage`でコードを翻訳し、APIの本文や未知の例外のmessageを直接描画しない。
フロント自身の公開文言は`UserFacingError`で明示する。画像の部分保存枚数はフロントが確認した枚数だけを表示する。

業務データの取得・保存・認可は言語に依存させない。
現在は商品名などの多言語コンテンツ、メール・PDF生成、利用者の言語設定のDB保存は実装していない。
それらを追加するときは対象のlocaleを明示的な入力として扱い、バックグラウンド処理で画面Cookieを推測しない。
個別の制約値が必要なAPIエラーは、内部データを含まない公開引数の契約を定義してから追加する。

## 受け入れ条件と検証

- 日本語辞書なしで原文を表示し、英語辞書と原文の引数が一致する。
- 未翻訳原文、ドット・コロン、差し込み値をそのまま扱う。
- 同時に進む日英のSSR要求が言語を引き継がない。
- 3画面のSSRシェルとブラウザーが同じ言語になり、切替・再読み込み後も保持する。
- 未対応Cookieは日本語へ戻す。
- 英語の検証・APIエラーでも入力を保持し、内部本文を公開しない。
- 既存の認可・企業分離・注文・画像フローを維持する。

## 外部ツールの制約

Storybookの既存チャンクサイズ警告とvite-plusのpeer範囲不一致は既知の上流制約として残る。
Paraglideと開発用SDKは削除する。deprecatedなyuku-codegen・yuku-parserのnative bindingは
vite-plus 0.3.3の推移依存でもあり、開発ツールに残る。アプリの実行時には含まれず、
上流の互換更新が出た際に解消する。Drizzleの既存esbuild-kit依存のdeprecated警告も残る。
