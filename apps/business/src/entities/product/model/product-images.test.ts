import { describe, it, expect } from "vite-plus/test";
import { productImages } from "#business/entities/product/model/product-images.ts";

const images = [
  { id: "side", key: "side-key", createdAt: "2026-01-01" },
  { id: "main", key: "main-key", createdAt: "2026-01-02" },
  { id: "back", key: "back-key", createdAt: "2026-01-03" },
];
describe("商品の代表画像と追加画像", () => {
  it("配列の先頭ではなくキーで代表画像を選び、追加画像の順序と元配列を維持する", () => {
    const result = productImages(images, "main-key");
    expect(result.primaryImage?.id).toBe("main");
    expect(result.additionalImages.map((props) => props.id)).toEqual(["side", "back"]);
    expect(images.map((props) => props.id)).toEqual(["side", "main", "back"]);
  });
  it("代表キーがないか一覧に見つからない場合も追加画像を失わない", () => {
    for (const key of [null, "missing-key"]) {
      const result = productImages(images, key);
      expect(result.primaryImage).toBeUndefined();
      expect(result.additionalImages).toEqual(images);
    }
  });
});
