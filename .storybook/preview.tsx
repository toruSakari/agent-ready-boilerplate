import { setLocale, isLocale } from "@dev-template/client/i18n";
import type { Preview } from "@storybook/react-vite";
import { useEffect, useEffectEvent } from "react";
import { ThemeProvider, useTheme } from "next-themes";
import { StoryProviders } from "#storybook/fixtures";
import type { StoryFixtures } from "#storybook/fixtures";
import "@/.storybook/preview.css";

// ツールバーの選択をnext-themesへ反映し、実画面と同じセマンティック色で比較する。
function ThemeSelection(props: { theme: string }) {
  const { setTheme } = useTheme();
  const applyTheme = useEffectEvent((value: string) => setTheme(value));
  useEffect(() => applyTheme(props.theme), [props.theme]);
  return null;
}

const preview: Preview = {
  tags: ["autodocs"],
  parameters: {
    layout: "padded",
    controls: { matchers: { color: /(background|color)$/i, date: /Date$/i } },
  },
  globalTypes: {
    locale: {
      description: "Display language",
      toolbar: { icon: "globe", items: ["ja", "en"], dynamicTitle: true },
    },
    theme: {
      description: "Component color theme",
      toolbar: { icon: "circlehollow", items: ["light", "dark", "system"], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: "light", locale: "ja" },
  decorators: [
    (Story, context) => {
      const locale = isLocale(context.globals.locale) ? context.globals.locale : "ja";
      // StorybookはSSRを持たず表示全体を管理するため、再読込みなしで比較する。
      setLocale(locale, { reload: false });
      document.documentElement.lang = locale;
      return (
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          storageKey="dev-template-storybook-theme"
          disableTransitionOnChange
        >
          <ThemeSelection key={context.id} theme={String(context.globals.theme ?? "light")} />
          <StoryProviders
            key={`${context.id}:${JSON.stringify(context.parameters.fixtures)}`}
            fixtures={context.parameters.fixtures as StoryFixtures | undefined}
          >
            <Story />
          </StoryProviders>
        </ThemeProvider>
      );
    },
  ],
};
export default preview;
