# ADR 011: リポジトリを分離できるパッケージ境界

## ステータス

採用。ADR 010の共通API・3画面を、所有元の内部エイリアスと公開パッケージ入口で接続する。
アプリ内のFSDと内部エイリアスは[ADR 017](017-frontend-feature-ownership.md)で拡張する。

## 背景

API・顧客・事業者・運営を別リポジトリで開発・配備できるようにする。
同じworkspaceにあることを理由に、型・ビルド設定・共通UIがサーバーのソースを直接参照してはいけない。

## 決定

内部参照はAPIの`#api/*`、共通クライアントの`#client/*`、画面のapp内の`#app/*`を使う。
画面のsrc内は、その所有アプリの`#web/*`・`#business/*`・`#admin/*`だけを使う。
サービスのpackage.jsonのimportsは`"#サービス/*": "./src/*"`へ統一し、APIの運用コードは`"#api-tooling/*": "./tooling/*"`とする。
importには`.ts`・`.tsx`を明示し、別スライスの公開入口は`#business/entities/product/index.ts`のように指定する。
[Nodeのsubpath patterns](https://nodejs.org/docs/latest-v24.x/api/packages.html#subpath-patterns)はワイルドカードの文字列置換であり、
拡張子やindexを補完しないため、ファイルごとの例外一覧を持たずに同じ解決を保証する。
TypeScriptのnoEmit設定ではallowImportingTsExtensionsを有効にし、JavaScriptを出力する共通設定のビルドでは無効にする。
ルート検証・Storybookのパスエイリアスも同じ実ファイルを指す。共有パッケージの公開exportsとクライアント内部の生成入口は別の規約として維持する。
各パッケージに自身のTypeScript設定を置き、共有設定は@dev-template/configの公開入口から利用する。
ルートの@/は全体検証に限る。apps・packagesからのルート参照と他パッケージの内部エイリアス利用をlintで拒否する。

APIのcontract.tsからAppRouter・RouterInputs・RouterOutputsを宣言ファイルへ生成する。
サーバーのDI contextを除き、入力・出力・エラー形式を保持する。型契約検証で元のルーターとの一致を確認する。
クライアントは生成済み@dev-template/api-typesだけを参照し、APIの実装・Cloudflare型へ依存しない。
生成にはTypeScript 7で提供されないコンパイラーAPIが必要なので、公式互換パッケージのTypeScript 6を生成処理に使う。
通常の型チェックはTypeScript 7のままにする。宣言ファイルは手で変更しない。

UI・共通クライアント・設定・型契約にはバージョンと公開対象を設定する。
Nodeが直接読むビルド設定はJavaScriptと宣言ファイルへビルドする。
UI・クライアントはTS/TSXソースを配布し、TanStack Start/Vite側で変換する。CSSの探索は各パッケージ自身のsrcを起点にし、
アプリ固有のapp・srcはそのアプリのCSSで探索する。共有パッケージからアプリのソースを探索しない。
API・クライアントは自身のテスト設定を持ち、ルートなしでもテストを実行できる。

repository:exportはアプリのGit管理対象と非ignoreの新規ファイルを新規ディレクトリへコピーする。
共有依存はpnpm packのtarballへ固定し、workspace依存をfile依存へ変換する。
pnpm 11の設定はpnpm-workspace.yamlへ引き継ぎ、出力先の上書きと認証情報・ローカルデータの持ち出しを避ける。

## 選択肢

- ルートエイリアスを残し、分離時に修正する：切り出しまで問題が見つからない。
- すべての共有コードをアプリへ複製する：更新の同期が難しくなる。
- 公開パッケージと生成契約で接続する：採用。workspaceと独立リポジトリで同じ入口を使える。

## 影響

同じCloudflareアカウントなら別リポジトリになってもService Bindingで共通APIへ接続できる。
APIを別プラットフォームへ移す場合はHTTP接続と認証・CORS・運営Access JWTの設計が別途必要になる。
型契約の互換性を保ち、API変更時は生成・検証・共有パッケージのバージョン更新を行う。
公開レジストリへの配布や新リポジトリ作成は別途行う運用作業とする。
手順は[切り出し手順](../repository-split.md)を参照する。
