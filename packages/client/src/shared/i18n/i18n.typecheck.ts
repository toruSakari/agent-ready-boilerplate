import { t } from "#client/shared/i18n";
import type { Locale } from "#client/shared/i18n";
import type { InterpolationNames } from "#client/shared/i18n/runtime";

type Assert<T extends true> = T;

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

// 原文中の差し込み引数を型検査し、辞書のない日本語原文も受け付ける。
export type TranslationContracts = [
  Assert<Equal<Locale, "ja" | "en">>,
  Assert<Equal<InterpolationNames<"SKUは{{max}}文字以下です">, "max">>,
  Assert<Equal<InterpolationNames<"{{name}}は{{max}}文字以下です">, "name" | "max">>,
  Assert<Equal<Parameters<typeof t<"SKUは{{max}}文字以下です">>[1], { max: string | number }>>,
];
