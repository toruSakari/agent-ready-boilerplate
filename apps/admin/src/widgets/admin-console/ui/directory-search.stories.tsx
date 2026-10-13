import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { adminFixtures } from "#admin/test/admin-story-fixtures.ts";
import { DirectorySearch } from "#admin/widgets/admin-console/ui/directory-search.tsx";

const meta = {
  title: "Admin/Components/DirectorySearch",
  component: DirectorySearch,
  args: {
    id: "directory-story",
    label: "名前を検索",
    placeholder: "名前を入力",
    value: "",
    onChange: fn(),
  },
  parameters: { fixtures: adminFixtures() },
} satisfies Meta<typeof DirectorySearch>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
