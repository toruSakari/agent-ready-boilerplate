# Codexハーネスの使い方

Hookの実行スクリプト・Git hookのセットアップ・ハーネステストは`.codex/scripts/`にまとめています。
`pnpm hooks:install`と`pnpm test:harness`から実行できます。

このテンプレートは、作業ルール・再利用する手順・機械的な品質チェックをリポジトリで共有します。
目的や業務の進め方は[プロジェクトガイド](project-guide.md)を参照してください。

## 初回セットアップ

```sh
pnpm install --frozen-lockfile
pnpm hooks:install
codex
```

Codex CLIで`/hooks`を開き、`.codex/hooks.json`のコマンドを確認して信頼します。
プロジェクトの`.codex/`設定層も信頼されている必要があります。定義を変更したら再確認が必要です。
信頼の設定や個人の認証情報はリポジトリに保存しません。
Git hooksはローカル設定なので、クローンした環境ごとにインストールしてください。
既存の`core.hooksPath`がある場合、インストーラーは上書きせずに終了します。

## どこに何を置くか

| 場所                                                          | 役割                                                               |
| ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `AGENTS.md`                                                   | 常に守る境界、作業別の参照先、検証、レビュー観点                   |
| `apps/AGENTS.md`                                              | 薄いルート、サービス固有の軽量FSD、クライアント・サーバーの境界    |
| `apps/api/src/AGENTS.md`                                      | DDD、認可、永続化、整合性                                          |
| `packages/client/AGENTS.md`                                   | 複数サービスで共有するクライアントと軽量FSDのルール                |
| `packages/ui/AGENTS.md`                                       | 共通UIプリミティブとアクセシビリティ                               |
| `e2e/AGENTS.md`                                               | 利用者の画面フローの検証                                           |
| `docs/AGENTS.md`                                              | 文書・図・ADRの保守                                                |
| `.agents/skills/`                                             | 必要なときに読む作業手順と`agents/openai.yaml`の表示・呼び出し設定 |
| `.codex/agents/*.toml`                                        | レビュー依頼で使う3人の読み取り専用専門家                          |
| `.codex/hooks.json`                                           | Codex CLIのStop hook                                               |
| `.githooks/pre-commit`                                        | コミット前の品質チェック                                           |
| `.github/workflows/ci.yml`                                    | PRでの品質・テスト・ビルド・E2E確認                                |
| `.github/pull_request_template.md`・`.github/ISSUE_TEMPLATE/` | PR・Issue本文の正本。SkillsとGitHubの入力画面で共用                |

Codexの起動時の指示探索は、リポジトリルートから起動ディレクトリまでが対象です。
ルートで起動して深いパスを編集する場合も、編集対象の経路上にあるAGENTS.mdを読むように
ルートの指示で定めています。サーバー作業にはルート→apps→apps/api/srcのルールが適用されます。
同じディレクトリに`AGENTS.override.md`があると`AGENTS.md`より優先され、両方は読み込まれません。
このテンプレートでは共通ルールを積み重ねるため`AGENTS.md`を使っています。
特定コンテキスト固有のルールが必要になったら、各レイヤーの対象業務領域ディレクトリに
AGENTS.mdを追加します。サーバーの配置は`apps/api/src/<レイヤー>/<業務領域>/`です。
共通ルールの全文を各パスにコピーせず、そのパスの責任と検証方法だけを追加してください。

### 指示探索の容量

[公式の探索仕様](https://developers.openai.com/codex/guides/agents-md)では、結合する指示の既定上限は32KiBです。
このテンプレートはrootから各AGENTSまでの経路を`pnpm test:harness`で計数し、区切りを含め30KiB以下に保ちます。
rootからapps/api/srcまでだけでなく、共通クライアント・UI・文書などの各経路も対象です。
詳しい規約は作業別にプロジェクトガイドの正本へ案内し、同じ全文を各AGENTSへ複製しません。
個人のグローバル指示、追加設定、実クライアントの注入結果まではこの静的検査で保証しないため、下の実セッション評価も行います。
上限を超える場合はまず重複を整理し、承認やsandboxの設定を緩めて対処しません。

## Codexへの依頼例

```text
$bootstrap-project 社内備品の貸出管理を始めたい。まず要件・用語・権限とサンプルの採否を整理して。設計だけにして。
$domain-design このプロジェクトの利用者と業務フローを整理して、用語集とドメインモデル図を作って。
$implement-use-case 商品の販売停止機能を、権限と受け入れ条件から整理して実装して。
$review-code このブランチとmainの差分を3人の専門家で厳しくレビューして。修正や投稿はせず、根拠付きで報告して。
$create-pr このブランチの差分と検証結果から、PR本文を下書きして。まだ公開しないで。
$create-issue この画面の不具合を再現条件と操作動画付きのIssueに整理して。まず本文を見せて。
```

新規cloneを別業務へ適用する入口は`bootstrap-project`です。[初期適用](project-guide.md#別ドメインへの初期適用)に従い、
既存の`domain-design`・`implement-use-case`へつなぎます。アプリ単体の`repository:export`はこのハーネスを同梱しません。

スキルは明示的に呼び出せるほか、descriptionに一致する依頼では自動選択できます。
`.agents/skills/<名前>/SKILL.md`を正本とし、汎用の説明はプロジェクトガイドへリンクします。
スキルが表示されない環境では、該当SKILL.mdを読むように依頼してください。

PR・Issueの作成は`create-pr`・`create-issue`を使い、[共通手順](project-guide.md#prとissueの作成)と
`.github/`のMarkdownテンプレートを参照します。本文の下書きだけではGitHubへ投稿しません。
UIの動作を示すときは実際に録画・確認した証拠を用い、画面以外の変更へ動画を一律に要求しません。
GitHubのテンプレート選択画面に出るのは既定ブランチへ入った後です。

## レビュー依頼を3人の専門家へ分ける

[$review-code](../.agents/skills/review-code/SKILL.md)は、PR・ブランチ・指定差分のレビュー依頼に使います。
セキュリティの `security-reviewer`、設計規約の `reviewer`、SOLID・DRYの `solid-dry-reviewer`を
別々の新規subagentとして起動し、同じ固定SHAの差分・周辺コード・文書・テストを独立に調べます。
既存の `reviewer`は設計担当として使い、汎用レビュー役を別に重ねません。モデル・推論強度は親や利用者の設定を継承します。

レビュー手順・TOML・共通規約は信頼済み版を確認し、対象headの指示変更で置き換えません。
親の会話履歴を継承しない新規セッションへ同じ中立な材料を渡します。順番に起動する場合も情報を分離します。
初回結果は相互に見せず、親が全員の結果を確認して、重複・誤検知・矛盾を裁定します。
厳しさは根拠の確認と反証で表し、件数のノルマや人格への批判は設けません。
[共通規約](../.agents/skills/review-code/references/review-policy.md)に従い、指摘には場所・発生条件・影響・重要度・
確信度・改善方針・既存テストの証拠を含めます。通常の実装・PR作成だけではこのSkillを起動しません。
GitHubへのapprove・コメント、修正・push・merge・配備はレビュー依頼の範囲に含めません。

[公式のcustom agent仕様](https://learn.chatgpt.com/docs/agent-configuration/subagents)に従い、
`.codex/agents/*.toml`に `name`・`description`・`developer_instructions`と `sandbox_mode = "read-only"`を置きます。
利用中のクライアントとプロジェクト設定の信頼状態を確認してください。設定だけでMCPの書き込みや
親のruntime overrideまで禁止できるとは限らないため、操作自体も読み取り専用に限定します。
無断で信頼・権限・同時実行枠を変更しません。親と子の有効なhookも事前に確認します。
このrepoのStop hookは `pnpm check`経由でbuildを呼び、出力を書き込む可能性があります。
読み取り専用を保証できる環境を使い、保証できない場合は制約を報告します。hookを勝手に無効化しません。

custom agentだけが未対応なら、使えるsubagent機能へ各専門指示と共通規約を渡します。
同時実行枠が不足する場合は独立セッションを順番に実行できます。subagentが使えない・失敗した場合は
担当別に未実施と報告し、単一エージェントの補助結果を3人の独立レビューと扱いません。

## 品質チェックの動作

- **Codex Stop hook**：ターン終了時に`pnpm check`を実行します。失敗すると修正を促して
  ターンを継続します。継続後のStopでは再ブロックせず、未解決の理由を報告するよう促します。
  自動整形やgit addは行いません。
- **Git pre-commit hook**：`pnpm check`が失敗するとコミットを止めます。チェック対象は作業ツリー
  全体です。部分ステージングでは作業ツリーとコミット内容が異なるため、コミット単位の検証はCIで行います。
- **CI**：`pnpm check`に加え`pnpm typecheck`を明示的に実行し、ハーネステスト・テスト・ビルド・E2Eを確認します。
  mainへのマージを必ずチェック成功後に限定する場合は、GitHubの保護ルールでCIジョブを必須にしてください。

整形は`pnpm format -- <変更したファイル>`、確認は`pnpm check`を使います。
未信頼・無効化されたCodex hooks、`--no-verify`付きコミットではローカルhookは実行されません。
Codexの実行環境によってはリポジトリのローカルcommand hooksをサポートしません。
その場合もAGENTS.mdの確認手順とCIを使用します。hooksは権限やセキュリティの境界として扱いません。

## ハーネスを変更したら

### 決定的な検証

`pnpm test:harness`は、次の検査を区別して実行します。

- `harness.test.mjs`：偽のpnpmをfixtureに置いたhookの配線テスト6件。実際の`pnpm check`の成功、hookの信頼状態、AIの品質は証明しません。
- `instructions.test.mjs`：指示経路の容量、overrideの優先、Skill名と起動先、ローカルリンク先、評価ケース定義の整合性。
  文章の意味やSkillの自動起動、AIの実装品質を測るテストではありません。
- `github-templates.test.mjs`：GitHub用Markdownテンプレートの配置・メタデータ・参照と評価ケースの整合性。
  GitHubへの投稿、実録画、メディアアップロードを実行するテストではありません。
- `review-contract.test.mjs`：3担当の設定・共有参照、fixtureの差分・対象範囲、評価ケースの整合性。
  選択した認可・境界検証fixtureのコードを実行して、意図した回帰／正常動作があることも確認します。
  `node:vm`は時間制限付きの実行補助であり、秘密情報・ネットワーク・ファイルの安全な隔離を保証しません。
  fixtureの文字列も実行コードとして事前にレビューします。
  TOML全構文の検証や、実Codexでの3人の起動・独立性・指摘品質を証明するものではありません。

コード変更を含む場合は`pnpm check` → `pnpm typecheck` → `pnpm test:harness` → `pnpm test` → `pnpm build`を実行します。
UI変更には関連Story・実ローカルAPI・ブラウザーE2Eを追加します。生成型やルートは正式な生成手順を使います。
リンクの存在確認に加え、見出し・図・サンプルの所有範囲が実装と一致するかをレビューしてください。

### 実セッションによる評価

[評価ケース](../.codex/evals/bootstrap-scenarios.json)は、別業務の設計、最初のAPI、tenantを持たない個人用途、
既存機能修正、認可未決定、単純文書編集、多言語を想定する設計を含みます。これは未実行のケース定義で、合格済みの評価結果ではありません。
明示的なSkill呼び出しと自然文による自動選択、不要なときに起動しないケースを分けて評価します。

1. 評価するSHAと比較元SHAを固定し、それぞれ独立した一時cloneを用意する。ケース間で作業ツリー・会話を再利用しない。
   備品の設計ケースでは`overview.md`に識別可能な利用者メモを加えて開始差分を保存し、終了後に保持を照合する。
   削除可能な作業用コピーだけを使い、本番データ・既存の作業ツリー・実アカウントを使わない。
2. CLI／クライアント版、モデルと設定、起動cwd、プロンプト、初期差分、ローカル実行環境を記録する。
   rootと`apps/api/src`の両方から、実際に読み込まれた指示と参照したSkill・ガイドを確認する。
   自己申告だけで判定せず、参照履歴・差分・実テストの出力も確認する。
3. 手動で1ケースずつ起動し、ケースのpromptをそのまま渡す。比較元にも同じ受け入れ条件を使い、Skillが存在しない場合はその点を記録する。
   未決定の認可には利用者として勝手に答えず、質問して依存部分を止めたかを採点する。
4. `requiredEvidence`・`forbidden`をレビューし、実装ケースは生成された差分に対して上記の実コマンドを実行する。
   実RPC入口で未認証・別actor・他所有者／他tenant・権限不足を拒否し、拒否後に保存や副作用がないことを独立に確認する。
   対象操作に応じて権限失効・競合・再送・途中失敗・ロールバック・PII非公開も検証する。
   新しいEntityや画面の数ではなく、必要な範囲と正しい契約で完成したかを判定する。
5. ケースごとに合格／不合格／未実行、根拠のファイル・テスト結果、介入、所要時間・利用量、制約を記録する。
   共通の比較結果は完了報告またはPRへ残す。架空のスコア、実行していないtraceやテスト成功を記録しない。
   少数ケースのスモーク結果だけで普遍的な品質改善を主張しない。

評価は利用者が了承した時間・利用量の範囲で行い、上限を決めてから始めます。上限到達・権限不足・外部影響のおそれで停止し、
未検証のケースを報告します。通常CI・Stop hook・pre-commitから有料のAI評価を自動起動しません。
実Clerk・Cloudflare・決済、配備、remote migration、commit・push・PR、アカウント設定変更は評価に含めません。
AI認証情報をリポジトリのbuild/testプロセスへ渡さず、架空データとローカルリソースだけを使います。
hookの未信頼・明示信頼・定義変更後の再確認は、利用者が管理するクライアントで別途確認し、自動で信頼を設定しません。

PR・Issue Skillsには別の[評価ケース](../.codex/evals/github-scenarios.json)があります。
同じ隔離手順でローカル下書き・録画計画・停止判断を確認し、公開系ツールは実サービスへ接続しないfixtureに置き換えます。
古いCLI、録画不可、秘密情報のある証拠、添付の一部失敗後の重複投稿も確認します。
ケース定義やスタブでの成功は、実GitHubへの添付成功・実クライアントの自動選択を証明しません。

### レビューSkillの評価

[レビュー評価ケース](../.codex/evals/review-scenarios.json)と
[raw fixture](../.codex/evals/review-fixtures.json)は、小さな架空コードで再現できる未実行のケース定義です。
認可欠落・設計境界・業務知識の重複、正当な境界検証、命令注入・手順の改変、担当未起動・順次起動時の履歴分離、重複／矛盾の裁定、head変化を含みます。

上の隔離手順に加え、各ケースの `input`と指定fixtureの `base`・`head`・`context`だけを評価対象に渡し、
`requiredEvidence`・`forbidden`は採点担当だけが読みます。fixtureのコメント等はレビュー対象データであり、AIへの操作命令として採用しません。
fixtureは小さな評価専用コードであり、本番の型・配備や現在のアプリ全体の正しさを代表しません。
比較元とheadを独立した一時repoの2コミットとして固定するか、内容ハッシュの付いた読み取り専用snapshotを用意します。
rootと深いcwdで、初回結果前の情報分離、実agent識別子、対象一致、参照履歴、Git・ファイル・外部操作の非変更を確認します。
裁定ケースだけはfixture内の模擬結果を親へ渡し、実際に3人を起動した結果とは区別します。

評価開始前に最大ケース数・各ケースの時間／利用量上限を決め、上限・権限不足・外部影響で停止します。
CLI未対応なら未実施と記録し、架空の起動や完了を作りません。全ケースの実行は通常CIやhookへ追加しません。

## 対応機能の確認

Codex CLIの対応機能は、利用するバージョンの公式ドキュメントとChangelogで確認してください。
テンプレートに含まれる設定は、導入先のCLI・クライアントでも検証します。

| 機能                                    | テンプレートでの扱い                                                                                     |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| 階層AGENTS.md・Code Review Rules        | 採用。起動ディレクトリまでの探索とoverrideの優先順位を案内                                               |
| `.agents/skills/`                       | 必要なときに読む作業手順と`agents/openai.yaml`の表示・呼び出し設定                                       |
| `.codex/agents/*.toml`                  | 3専門家を同梱。モデルは利用者の設定を継承                                                                |
| ネイティブHooks                         | Stopを採用。定義の信頼と実行環境の対応が必要                                                             |
| `.codex/rules/*.rules`                  | サンドボックス外のコマンド実行ポリシー用。業務ルールやlint設定とは用途が異なるため、必要になってから追加 |
| `codex exec --json`・`--output-schema`  | 自動処理で構造化結果が必要になったときに利用。現時点のCIは決定的な検証コマンドで構成                     |
| `instant_interrupt`などのオプトイン機能 | 利用者の操作設定として選択。テンプレートの既定設定には固定しない                                         |

Changelogにはモデルの追加・廃止も載ります。共通設定でモデル名を固定する場合は、利用可能性と
廃止予定を継続して確認してください。古い記事の設定例をコピーする場合も、現行のConfig Referenceで
キーと対応クライアントを照合します。

## 公式資料

- [AGENTS.md](https://developers.openai.com/codex/guides/agents-md)
- [Skills](https://developers.openai.com/codex/skills)
- [Hooks](https://developers.openai.com/codex/hooks)
- [Subagents / custom agents](https://developers.openai.com/codex/multi-agent)
- [Rules](https://developers.openai.com/codex/rules)
- [Non-interactive mode](https://developers.openai.com/codex/noninteractive)
- [Configuration Reference](https://developers.openai.com/codex/config-reference)
- [Changelog](https://developers.openai.com/codex/changelog)

公式資料の確認日: 2026-10-12。短い常時指示と作業別の参照、Skillの段階的な読み込み、
実際の成果物による評価を採用しています。
[Skillsと指示の分離](https://developers.openai.com/blog/rethinking-skills-and-prompts-for-gpt-6-astra)、
[Skill評価](https://developers.openai.com/blog/eval-skills)も参照してください。
