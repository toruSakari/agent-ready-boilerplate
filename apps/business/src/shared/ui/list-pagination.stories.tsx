import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { ListPagination } from "#business/shared/ui/list-pagination.tsx";

const meta = {
  title: "Business/Components/ListPagination",
  component: ListPagination,
  args: {
    label: "ページ切替",
    page: 0,
    fetching: false,
    hasNextPage: true,
    previousPage: fn(),
    nextPage: fn(),
  },
  parameters: { fixtures: { mode: "business", organizationId: "story-business", image: "ready" } },
} satisfies Meta<typeof ListPagination>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const LastPage: Story = { args: { page: 2, hasNextPage: false } };
export const Fetching: Story = { args: { fetching: true } };
