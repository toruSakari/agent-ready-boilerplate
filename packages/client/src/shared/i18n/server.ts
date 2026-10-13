import { AsyncLocalStorage } from "node:async_hooks";
import {
  createTranslationInstance,
  localeFromCookie,
  useRequestContext,
} from "#client/shared/i18n/runtime";
import type { Locale } from "#client/shared/i18n/runtime";
import type { i18n } from "i18next";

const requests = new AsyncLocalStorage<{ locale: Locale; instance: i18n }>();
useRequestContext(() => requests.getStore());

/** SSR・ストリーミング中の翻訳を要求ごとに分離し、他の利用者の言語を引き継がない。 */
export function i18nMiddleware(
  request: Request,
  next: () => Promise<Response> | Response,
): Promise<Response> {
  const locale = localeFromCookie(request.headers.get("Cookie") ?? "");
  return requests.run({ locale, instance: createTranslationInstance(locale) }, async () => next());
}
