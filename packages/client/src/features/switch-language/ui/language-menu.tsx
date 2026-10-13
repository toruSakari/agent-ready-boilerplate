"use client";
import { useSyncExternalStore } from "react";
import { getLocale, isLocale, setLocale, t as translate } from "#client/shared/i18n";
import { NativeSelect, NativeSelectOption } from "@dev-template/ui/native-select";

/** Cookie更新後に文書を再取得し、SSR・HTML属性・画面の言語をまとめて切り替える。 */
export function LanguageMenu() {
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return (
    <NativeSelect
      aria-label={translate("表示言語を選択")}
      value={getLocale()}
      disabled={!hydrated}
      onChange={(event) => {
        if (isLocale(event.target.value)) {
          setLocale(event.target.value);
        }
      }}
    >
      <NativeSelectOption value="ja">日本語</NativeSelectOption>
      <NativeSelectOption value="en">English</NativeSelectOption>
    </NativeSelect>
  );
}
