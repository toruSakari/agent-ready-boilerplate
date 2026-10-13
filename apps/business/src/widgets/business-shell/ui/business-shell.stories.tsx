import type { Meta, StoryObj } from "@storybook/react-vite";
import { BusinessShell } from "#business/widgets/business-shell/ui/business-shell.tsx";

const product = {
  id: "product-a",
  tenantId: "story-business",
  sku: "MUG-001",
  name: "藍色のマグカップ",
  unitPrice: 2400,
  imageKey: null,
  images: [],
  createdAt: "2026-10-01T00:00:00Z",
};
const order = {
  id: "order-a",
  tenantId: "story-business",
  customerId: "customer-a",
  status: "draft",
  lines: [{ sku: "MUG-001", name: "藍色のマグカップ", quantity: 2, unitPrice: 2400 }],
  total: 4800,
  version: 1,
  reservationId: null,
  createdAt: "2026-10-01T00:00:00Z",
  paymentStatus: null,
};
const fixtures = {
  mode: "business",
  organizationId: "story-business",
  queries: {
    "access.session": {
      data: {
        permissions: [
          "order:read",
          "order:create",
          "order:update",
          "product.read",
          "product.update",
          "member.read",
        ],
        platformPermissions: [],
      },
    },
    "dashboard.summary": {
      data: {
        ordersTotal: 12,
        draftCount: 2,
        confirmedCount: 6,
        productsTotal: 8,
        membersTotal: 3,
      },
    },
    "order.list": { data: [order] },
    "order.get": { data: order },
    "product.get": { data: product },
    "product.list": { data: [product] },
  },
};

const meta = {
  title: "Business/Workspace/BusinessShell",
  component: BusinessShell,
  args: { title: "販売者センター", children: "今日の注文と商品を確認します。" },
  parameters: { layout: "fullscreen", fixtures },
} satisfies Meta<typeof BusinessShell>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
