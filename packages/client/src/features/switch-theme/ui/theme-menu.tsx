"use client";
import { t as translate } from "#client/shared/i18n";

import { DEFAULT_THEME, THEME_MODES } from "#client/features/switch-theme/model/theme-settings";
import { useSyncExternalStore } from "react";
import { SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@dev-template/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@dev-template/ui/dropdown-menu";

export function ThemeMenu() {
  // サーバーではOS設定やlocalStorageを読めないため、初期のラベル・アイコンを固定する。
  // クライアント初期化が終わるまで切替操作を無効にして、SSRとの表示差を避ける。
  const hydrated = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label={translate("テーマを選択")}
          disabled={!hydrated}
        >
          <SunMoon aria-hidden="true" />
          {translate("表示テーマ")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{translate("表示テーマ")}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={theme ?? DEFAULT_THEME} onValueChange={setTheme}>
          <DropdownMenuRadioItem value={THEME_MODES.light}>
            {translate("ライト")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value={THEME_MODES.dark}>
            {translate("ダーク")}
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value={THEME_MODES.system}>
            {translate("システム設定に合わせる")}
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
