import { describe, expect, it } from "vite-plus/test";
import { AllowedIpRange } from "#api/domain/access/value-objects/allowed-ip-range.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";

describe("企業画面の許可IP", () => {
  it.each([
    ["203.0.113.5", "203.0.113.5", true],
    ["203.0.113.5", "203.0.113.6", false],
    ["203.0.113.128/25", "203.0.113.255", true],
    ["203.0.113.128/25", "203.0.113.127", false],
    ["2001:db8::/32", "2001:db8:ffff::1", true],
    ["2001:db8::/32", "2001:db9::1", false],
    ["2001:db8::1", "2001:0db8:0:0:0:0:0:1", true],
    ["::ffff:192.0.2.1", "::ffff:c000:201", true],
    ["0.0.0.0/0", "2001:db8::1", false],
    ["::/0", "203.0.113.5", false],
  ])("許可範囲%sから接続元%sを判定する", (range, ip, allowed) => {
    expect(AllowedIpRange.contains(AllowedIpRange.create(range), ip)).toBe(allowed);
  });
  it.each([null, "", "unknown", "203.0.113.5, 203.0.113.6", "203.0.113.5/32"])(
    "不明・不正な接続元%sは拒否する",
    (ip) => {
      expect(AllowedIpRange.contains(AllowedIpRange.create("203.0.113.5"), ip)).toBe(false);
    },
  );
  it.each(["invalid", "256.0.0.1", "1.2.3.4/33", "::/129", "::/-1", "::/", "::/1/2"])(
    "不正な許可範囲%sを保存させない",
    (ip) => {
      expect(() => AllowedIpRange.create(ip)).toThrow(InvalidValueObjectError);
    },
  );
  it("単一文字列を正規化して保持し、複合設定を拒否する", () => {
    expect(AllowedIpRange.create(" 203.0.113.5/32 ")).toBe("203.0.113.5/32");
    for (const value of [{ enabled: true, allowedIps: ["::1"] }, ["::1"], null]) {
      expect(() => AllowedIpRange.create(value)).toThrow(InvalidValueObjectError);
    }
  });
});
