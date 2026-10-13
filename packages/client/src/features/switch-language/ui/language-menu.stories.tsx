import type { Meta, StoryObj } from "@storybook/react-vite";
import { LanguageMenu } from "#client/features/switch-language/ui/language-menu";

const meta = {
  title: "Client/Features/SwitchLanguage/LanguageMenu",
  component: LanguageMenu,
  parameters: { layout: "centered" },
} satisfies Meta<typeof LanguageMenu>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Japanese: Story = { globals: { locale: "ja" } };
export const English: Story = { globals: { locale: "en" } };
