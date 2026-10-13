import { describe, it, expect } from "vite-plus/test";
import { imageChangeValidationError } from "#business/features/manage-product-image/model/image-change.ts";

const png = new File(["png"], "image.png", { type: "image/png" });
describe("画像編集の送信前検証", () => {
  it("先行画像が正常でも後続の形式不正を送信前に拒否する", () => {
    const invalid = new File(["text"], "invalid.txt", { type: "text/plain" });
    expect(imageChangeValidationError({ kind: "append", files: [png, invalid] }, 0)).toBe(
      "5MB以下のPNG・JPEG・WebP画像を選んでください",
    );
  });
  it("容量の境界は許可し、1バイト超過を拒否する", () => {
    const maximum = new File([new Uint8Array(5 * 1024 * 1024)], "max.png", { type: "image/png" });
    const oversized = new File([maximum, "x"], "oversized.png", { type: "image/png" });
    expect(imageChangeValidationError({ kind: "replace", file: maximum }, 0)).toBeNull();
    expect(imageChangeValidationError({ kind: "replace", file: oversized }, 0)).not.toBeNull();
  });
  it("20枚目の追加は許可し、上限時の追加だけ拒否して差し替え・削除を許可する", () => {
    expect(imageChangeValidationError({ kind: "append", files: [png] }, 19)).toBeNull();
    expect(imageChangeValidationError({ kind: "append", files: [png] }, 20)).toBe(
      "商品画像は20枚までです",
    );
    expect(imageChangeValidationError({ kind: "replace", file: png }, 20)).toBeNull();
    expect(imageChangeValidationError({ kind: "remove", imageId: "main" }, 20)).toBeNull();
  });
});
