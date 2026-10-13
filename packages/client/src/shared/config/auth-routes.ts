export const SERVICE_ACCOUNT_PATH = "/account";

export const SIGN_IN_PATH = "/sign-in";
export const isSignInPath = (path: string) =>
  path === SIGN_IN_PATH || path.startsWith(`${SIGN_IN_PATH}/`);

/** 同一originの相対パスだけを許し、ログインループとfragmentの持ち越しを防ぐ。 */
export function safeReturnPath(value: string | null, origin: string): string {
  if (!value?.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/";
  }

  try {
    const url = new URL(value, origin);
    if (url.origin !== origin || isSignInPath(url.pathname)) {
      return "/";
    }

    // 招待の秘密を含むfragmentを、認証の戻り先URLに再び載せない。
    return url.pathname + url.search;
  } catch {
    return "/";
  }
}

export function signInUrl(returnTo: string) {
  return `${SIGN_IN_PATH}?returnTo=${encodeURIComponent(returnTo)}`;
}

const SIGN_IN_RETURN_STORAGE_KEY = "dev-template-sign-in-return";

export function readSignInReturnPath(
  browser: Pick<Window, "location" | "sessionStorage">,
  fallback: string,
) {
  const explicit = new URLSearchParams(browser.location.search).get("returnTo");
  const nestedSignIn = browser.location.pathname.startsWith(`${SIGN_IN_PATH}/`);
  let candidate = explicit ?? fallback;
  try {
    // MFA等のネストしたログイン画面ではクエリが消えても、同じタブに保存した戻り先を使う。
    if (explicit === null && nestedSignIn) {
      candidate = browser.sessionStorage.getItem(SIGN_IN_RETURN_STORAGE_KEY) ?? fallback;
    }

    const safe = safeReturnPath(candidate, browser.location.origin);
    browser.sessionStorage.setItem(SIGN_IN_RETURN_STORAGE_KEY, safe);
    return safe;
  } catch {
    // 保存を拒否するブラウザーでも遷移は可能にし、戻り先の安全性チェックは省略しない。
    return safeReturnPath(candidate, browser.location.origin);
  }
}
