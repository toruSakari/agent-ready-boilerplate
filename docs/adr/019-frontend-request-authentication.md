# ADR 019: beforeLoadと表示ガードで画面の利用条件を示す

## ステータス

採用。TanStack Startへの接続は[ADR 024](024-tanstack-start-frontend.md)に従う。
ADR 018のAPI認証・認可、サービス会員・所属・退会の独立性は維持する。

## 決定

各アプリの`app/routes`へ本人確認用のpathless layout `_authenticated`を置き、
内側の`_qualified`で顧客・事業者・運営のサービス資格を明示する。
`/account`は本人確認だけを要求し、未登録・資格喪失後も登録確認・退会に進める。
ログイン・招待・webの登録入口は両ガードの外に置く。

```text
app/routes/
  __root.ts
  (web)/
    sign-in/
      route.ts                           # 公開
      -page.tsx
      $/route.ts                         # 公開の追加認証、表示は親で共有
    register/route.ts                    # 公開登録
    invitations/accept/route.ts          # 招待を先に回収
    _authenticated/
      layout.ts                          # beforeLoadとAuthenticationGate
      -layout.tsx
      account/route.ts
      _qualified/
        layout.ts                        # beforeLoadと資格のリアルタイム監視
        -layout.tsx
        route.ts                         # /
        organizations/$organizationId/route.ts
```

groupとpathless layoutはURLへ出ない。businessとadminは自身のgroupとサービスを使う。ページは`route.ts`、ガードは`layout.ts`、表示接続は同じディレクトリの`-page.tsx`・`-layout.tsx`に置く。命名設定はADR 024に従う。

`_authenticated`のbeforeLoadは登録状態確認APIで本人を確認し、未ログインなら元のパス・クエリを付けて
公開ログインへ移す。fragmentは認証の戻り先へ渡さない。`_qualified`は遷移先の企業IDで資格を確認する。
未登録の顧客は/register、企業・運営は/accountへ移す。登録確認が未登録なら保護セッションは取得しない。
資格拒否・通信障害・登録とセッションの会員ID不一致は業務ページのロードを止め、再試行できるエラー表示にする。

照会は各アプリのStart server functionから既存Hono＋tRPCへService Bindingで転送する。
サービスはアプリ側で固定し、企業IDはRouterが復号した遷移先のmatchから取得する。
CookieのセッションJWTをBearerとして渡し、API側で署名・状態・会員・所属・IP・運営Accessを再検証する。
戻すのは登録・拒否等の状態だけで、JWT・会員情報・基盤の例外をブラウザーへ返さない。
サーバー照会にも既存のスロットルを適用し、APIの業務判断をStart側へ複製しない。

layoutはProvider・Outlet・表示中の認証と資格の監視を接続する。
クライアント内の遷移ではサーバー要求がない場合もあるため、Cookie同期だけをページ遷移ガードの代わりにしない。

資格ガードは独立した登録確認が成功してから保護セッションを取得する。
30秒の再確認、60秒を超えた資格の停止、会員IDの不一致・通信失敗時の表示取り下げを維持する。
未登録者向けの登録CTA・事業者メニューは所有アプリが渡し、共通UIがURLから選ばない。

Root Providerは本人・サービス・企業別のキャッシュ、Clerk、招待、テーマを提供する。
公開ルート表や利用許可の判定は持たない。各アプリが復号済み企業IDを渡し、
企業・本人が変われば進行中の要求と古いキャッシュを破棄する。

### Cookie同期と表示ガードを分ける

各アプリの`src/_app/server/proxy.ts`をWorkerから呼び、Clerk Backend SDKでCookieとハンドシェイクを同期する。
署名・issuer・azp・userId・sessionId、要求origin、複数Set-Cookie、許可Locationを検証する。
偽装可能な転送Host・ProtoをClerkへ渡さず、設定漏れやLocationのないハンドシェイクは503で止める。
fetchで外部ハンドシェイクへ転送せず401でdocumentへの再試行を促す。

同期はログインを要求するルート表を持たない。SDKのsigned-out・MFA待ちでも公開shellを描画でき、
画面のガードとAPIが別々に資格を検査する。

招待の`#token`はサーバーへ届かない。招待入口だけは外部Clerk同期を先に行わず、
InvitationProviderでsessionStorageへの回収・URLからの消去を済ませてからClerkを初期化する。
保存・消去に失敗した場合は認証SDKを起動せず、秘密のfragmentが外部redirectへ継承されないようにする。

### データの認可はAPIで毎回行う

beforeLoadとlayoutは遷移・表示のガードであり、データの認可境界ではない。
Hono＋tRPCが本人、有効なサービス会員、対象企業、権限、所有者、運営Accessを毎回検証する。
サーバー取得を追加する場合も、その実行場所で認証・認可し、親layoutだけに依存しない。

## 設定・検証

各画面WorkerにCLERK_SECRET_KEYとCLERK_AUTHORIZED_PARTIES、ビルドに公開Clerkキーを設定する。
ローカルデモは開発ビルド・APP_ENV=local・loopback・鍵未設定の条件に限定する。
実Clerkの複数ドメイン・追加認証・期限更新は設定済み環境で別途検証する。

実RouterのURL・layout階層、直接アクセス・画面内遷移・ログアウト、本人／企業／会員IDとキャッシュ、
/account、招待fragment、実SDKのCookie同期、CSP nonce、APIの直接呼び出しを検証する。
資格拒否の検証では、Routerのerror boundaryが意図した拒否を捕捉した通知も出る。業務ページをロードせず、拒否表示と再試行が成立することを確認する。
