# Codexの作業ルール

このリポジトリは、Cloudflare向けアプリケーションとCodexの開発ハーネスのテンプレートです。
DDD・軽量FSD・命名・テストの規約を再利用し、業務の用語・利用者・権限は新しい要件から決めます。

## 作業の入口

- 作業前に`git status`で利用者の変更を確認し、上書きしない。
- [README](README.md)で構成を確認し、[プロジェクトガイド](docs/project-guide.md)とADRは作業に関係する節を読む。
- 編集対象までの経路にある`AGENTS.md`を読む。ルートで起動した場合も、対象パスの指示を確認する。
- 新しい業務への初期適用は[$bootstrap-project](.agents/skills/bootstrap-project/SKILL.md)、業務理解・図の整理は
  [$domain-design](.agents/skills/domain-design/SKILL.md)、機能追加・修正は
  [$implement-use-case](.agents/skills/implement-use-case/SKILL.md)を使う。カタログに見えない場合はリンク先を直接読む。
- PR本文・作成は[$create-pr](.agents/skills/create-pr/SKILL.md)、不具合報告・機能提案のIssueは
  [$create-issue](.agents/skills/create-issue/SKILL.md)を使う。下書きと公開を区別し、添付も依頼された公開範囲に従う。
- レビュー依頼は[$review-code](.agents/skills/review-code/SKILL.md)で3専門家へ独立に委任し、親が根拠を裁定する。
  通常の実装・PR作成だけでは起動せず、修正やGitHubへのレビュー投稿は別の依頼範囲として扱う。
- 業務・UXの判断前には[リサーチ方針](docs/project-guide.md#ドメインとuxを決める前のリサーチ)に従う。
  事実と仮説を分け、資料URL・確認日・採用／不採用の理由・未決定事項を`docs/project/`へ残す。
  利用者の要件を優先し、調査できない事項を推測で確定しない。判断を変えない整形等では再調査不要。

## 規約の読み分け

- コード変更時は[共通実装規約](docs/project-guide.md#共通実装規約)を全文読み、適用する。
  Entity・VO・DTO、Repository、SOLID・DRY、命名・import・コメント・ファイル分割などの共通規約をここに集めている。
- サーバーは[apps/api/src/AGENTS.md](apps/api/src/AGENTS.md)、アプリは[apps/AGENTS.md](apps/AGENTS.md)、
  共通クライアントは[packages/client/AGENTS.md](packages/client/AGENTS.md)、共通UIは[packages/ui/AGENTS.md](packages/ui/AGENTS.md)を追加で読む。
- 現在の業務は[現行サンプルの業務制約](docs/project/domain.md#現行サンプルの業務制約)と関連ADRに従う。
  商品・注文、customer・business・operator、3画面は新規プロジェクトの必須要件ではない。
  ただし別業務への適用を理由に、稼働中のサンプルの認可・テスト・データを削除しない。
  置き換える範囲と残す範囲は[初期適用](docs/project-guide.md#別ドメインへの初期適用)で明示する。

## 安全と検証

- 認可・テナント分離・入力検証はサーバーで保証する。UIの非表示、URL、クライアントのrole・tenant申告を信用しない。
  本人確認・現在権限と、UseCaseの所有・状態制約を維持する。未決定の認可をpublicや管理者権限へ仮置きしない。
- 個人情報・秘密情報・本文・生の例外をログへ渡さない。ログ・監視変更時は
  [ログと観測の共通規約](docs/project-guide.md#ログと観測の共通規約)を全文読み、適用する。
- 変更範囲を限定し、生成物・ロックファイルを手で編集しない。未実装機能を動くものとして表示しない。
- Nodeは`.nvmrc`、pnpmは`package.json`の指定を使う。初回は`pnpm install --frozen-lockfile`。
- 変更対象を整形し、コード変更は`pnpm check`、`pnpm typecheck`、`pnpm test`、`pnpm build`を実行する。
  画面フロー変更では関連E2E、ハーネス変更では`pnpm test:harness`も実行する。文書のみはリンク・Mermaid・整形を確認する。
- 警告・エラーは既存分も含めて0件にしてから完了する。行数・複雑度のwarningも責務を見直して解消する。
  無意味な分割、チェックの無効化・緩和、根拠のない抑制で通さない。
  環境由来で直せないものは原因・影響・解消条件を記録し、未実行・未解消を成功や完了として扱わない。
- 設計や業務ルールの変更には文書を追従させ、重要な判断はADRに理由と影響を残す。
  完了報告には変更内容、受け入れ条件の確認結果、検証結果、残る制約を含める。
  コミット・push・PR・マージ・配備は利用者の依頼範囲に従う。hookの信頼・承認設定を自動で緩めない。

## Code Review Rules

- 認可とテナント分離はサーバー側でも保証する。入力やクライアントのロールを信用しない。
- コンテキストを越えた集約の直接参照、冪等性の欠落、同時更新によるデータ損失を確認する。
- 動作変更に受け入れ条件と検証があるか確認する。format・lintは自動チェックに任せる。

## Storybook

- shadcn/uiを除く表示コンポーネントは同階層に自身のMetaを持つ`*.stories.tsx`を置き、通常・空・処理中・エラー・権限制限を確認する。
- ルート接続・認証通信Provider・リダイレクト・hookは単体・結合・E2Eで検証する。Storyのために本番の責務や公開APIを変えない。
- 通信は`#storybook/fixtures`で隔離し、実API・認証サービスへ接続しない。詳細は[Storybook](docs/storybook.md)に従う。
