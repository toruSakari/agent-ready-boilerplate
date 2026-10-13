// Worker環境の両方の型入口に、フロントエンドから共通APIへ接続するBindingを宣言する。
declare namespace Cloudflare {
  interface Env {
    API: Fetcher;
  }
}

interface Env {
  API: Fetcher;
}
