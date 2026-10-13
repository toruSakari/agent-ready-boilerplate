import { defineConfig } from "drizzle-kit";

export default defineConfig({
  // 各業務領域が所有するスキーマから生成する。drizzle配下の適用済み履歴は直接編集しない。
  schema: [
    "./src/infrastructure/access/schemas/schema.ts",
    "./src/infrastructure/order/schemas/schema.ts",
    "./src/infrastructure/inventory/schemas/schema.ts",
    "./src/infrastructure/product/schemas/schema.ts",
    "./src/infrastructure/payment/schemas/schema.ts",
  ],
  out: "./drizzle",
  dialect: "sqlite",
});
