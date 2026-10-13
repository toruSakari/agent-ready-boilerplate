// テーマはサービス会員や業務データから独立した表示設定。Providerと切替UIが同じ保存キーを使う。
export const THEME_MODES = Object.freeze({ light: "light", dark: "dark", system: "system" });
export const DEFAULT_THEME = THEME_MODES.system;
export const THEME_STORAGE_KEY = "dev-template-theme";
