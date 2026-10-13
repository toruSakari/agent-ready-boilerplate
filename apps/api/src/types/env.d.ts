// 秘密値はWranglerのvarsへ書かないため、生成型にない任意のsecretを両方のEnvへ補う。
declare namespace Cloudflare {
  interface Env {
    CLERK_SECRET_KEY?: string;
    SENTRY_DSN?: string;
  }
}

interface Env {
  CLERK_SECRET_KEY?: string;
  SENTRY_DSN?: string;
}
