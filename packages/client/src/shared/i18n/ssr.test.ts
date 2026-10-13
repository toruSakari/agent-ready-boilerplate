// @vitest-environment node
import { describe, expect, it } from "vite-plus/test";
import { i18nMiddleware } from "#client/shared/i18n/server";
import { cookieName, getLocale, t as translate } from "#client/shared/i18n";

describe("SSRの要求別言語", () => {
  it("同時に進む日英の要求と非同期処理で言語が混ざらない", async () => {
    let releaseEnglish!: () => void;
    const englishGate = new Promise<void>((resolve) => {
      releaseEnglish = resolve;
    });
    const english = i18nMiddleware(
      new Request("https://example.test/account", {
        headers: { Cookie: `${cookieName}=en` },
      }),
      async () => {
        await englishGate;
        return Response.json({ locale: getLocale(), label: translate("登録情報・退会") });
      },
    );
    const japanese = await i18nMiddleware(
      new Request("https://example.test/account", {
        headers: { Cookie: `${cookieName}=ja` },
      }),
      async () => {
        await Promise.resolve();
        releaseEnglish();
        return Response.json({ locale: getLocale(), label: translate("登録情報・退会") });
      },
    );
    expect(await japanese.json()).toEqual({ locale: "ja", label: "登録情報・退会" });
    expect(await (await english).json()).toEqual({
      locale: "en",
      label: "Registration and withdrawal",
    });
  });
});
