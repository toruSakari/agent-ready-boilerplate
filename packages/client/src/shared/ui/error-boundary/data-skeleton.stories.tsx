import type { Meta, StoryObj } from "@storybook/react-vite";
import { DataSkeleton } from "#client/shared/ui/error-boundary/data-skeleton";

const meta = { title: "Client/Shared/DataSkeleton", component: DataSkeleton } satisfies Meta<
  typeof DataSkeleton
>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Loading: Story = {};
export const NamedRegion: Story = { args: { label: "商品を読み込み中…" } };
