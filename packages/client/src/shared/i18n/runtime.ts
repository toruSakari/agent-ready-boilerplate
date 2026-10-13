import { createInstance } from "i18next";
import type { i18n } from "i18next";
import { english } from "#client/shared/i18n/en";

export const locales = ["ja", "en"] as const;

export type Locale = (typeof locales)[number];

export const baseLocale: Locale = "ja";
export const cookieName = "dev-template-locale";
const LOCALE_COOKIE_MAX_AGE_SECONDS = 31_536_000;

export function isLocale(value: unknown): value is Locale {
  return value === "ja" || value === "en";
}

/** 日本語原文がキーなので、辞書のない日本語・未翻訳の英語はキーを表示する。 */
export function createTranslationInstance(locale: Locale): i18n {
  const instance = createInstance();
  void instance.init({
    lng: locale,
    fallbackLng: false,
    resources: { en: { translation: english } },
    initAsync: false,
    keySeparator: false,
    nsSeparator: false,
    returnNull: false,
    interpolation: { escapeValue: false },
  });
  return instance;
}

type TranslationContext = { locale: Locale; instance: i18n };

let requestContext: () => TranslationContext | undefined = () => undefined;

/** サーバー専用入口から要求ストアを接続する。ブラウザーへNodeのモジュールを持ち込まない。 */
export function useRequestContext(resolve: typeof requestContext) {
  requestContext = resolve;
}

export function localeFromCookie(cookie: string): Locale {
  const value = cookie
    .split(";")
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1);
  return isLocale(value) ? value : baseLocale;
}

export function getLocale(): Locale {
  return (
    requestContext()?.locale ??
    (typeof document === "undefined" ? baseLocale : localeFromCookie(document.cookie))
  );
}

export function getTextDirection() {
  return "ltr";
}

export function setLocale(locale: Locale, props: { reload?: boolean } = {}) {
  const { reload = true } = props;

  if (!isLocale(locale)) {
    throw new Error("Unsupported locale");
  }

  if (typeof document === "undefined") {
    throw new Error("Language selection requires a browser");
  }

  document.cookie = `${cookieName}=${locale}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  if (reload) {
    window.location.reload();
  }
}

// クライアントの辞書は同期初期化し、SSRは要求専用インスタンスだけを参照する。
const browserInstances = {
  ja: createTranslationInstance("ja"),
  en: createTranslationInstance("en"),
};

export type InterpolationNames<Key extends string> =
  Key extends `${string}{{${infer Name}}}${infer Rest}` ? Name | InterpolationNames<Rest> : never;

type TranslationArgs<Key extends string> = [InterpolationNames<Key>] extends [never]
  ? []
  : [values: Record<InterpolationNames<Key>, string | number>];

export function t<Key extends string>(key: Key, ...args: TranslationArgs<Key>): string {
  const instance = requestContext()?.instance ?? browserInstances[getLocale()];
  return instance.t(key, args[0] ?? {});
}
