import type { Meta, StoryObj } from "@storybook/react-vite";
import { BusinessProductContent } from "#business/widgets/business-workspace/ui/business-product-content.tsx";

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
    "inventory.history": { data: [] },
    "inventory.get": { data: { onHand: 12, reserved: 2, available: 10 } },
    "product.list": { data: [product] },
  },
};

const meta = {
  title: "Business/Workspace/BusinessProductContent",
  component: BusinessProductContent,
  args: { id: "product-a" },
  parameters: { layout: "fullscreen", fixtures },
} satisfies Meta<typeof BusinessProductContent>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
