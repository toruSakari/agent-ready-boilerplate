import { describe, expect, it } from "vite-plus/test";
import {
  OrganizationEntity,
  BUSINESS_IP_MAX_ENTRIES,
} from "#api/domain/access/entities/organization.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { AllowedIpRange } from "#api/domain/access/value-objects/allowed-ip-range.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";

const organization = (enabled = false, ranges: readonly AllowedIpRange[] = []) =>
  new OrganizationEntity(
    AccessId.create("example"),
    AccessName.create("企業"),
    true,
    true,
    enabled,
    ranges,
  );

describe("企業のIP制限の整合性", () => {
  it("初期状態は無効で、接続元不明でも許可する", () => {
    expect(organization().allowsBusinessIp(null)).toBe(true);
  });
  it("有効な設定は一致する範囲だけを許可する", () => {
    const entity = organization(true, [AllowedIpRange.create("203.0.113.0/24")]);
    expect(entity.allowsBusinessIp("203.0.113.5")).toBe(true);
    expect(entity.allowsBusinessIp("203.0.114.5")).toBe(false);
    expect(entity.allowsBusinessIp(null)).toBe(false);
  });
  it("空の有効設定と、重複除去前の件数上限超過を拒否する", () => {
    expect(() => organization(true)).toThrow(InvalidValueObjectError);
    const ranges = Array<AllowedIpRange>(BUSINESS_IP_MAX_ENTRIES + 1).fill(
      AllowedIpRange.create("::1"),
    );
    expect(() => organization(false, ranges)).toThrow(InvalidValueObjectError);
  });
  it("許可一覧を重複除去し、呼び出し側の変更から保護する", () => {
    const range = AllowedIpRange.create("::1");
    const ranges = [range, range];
    const entity = organization(true, ranges);
    ranges.length = 0;
    expect(entity.businessAllowedIps).toEqual([range]);
    expect(Object.isFrozen(entity.businessAllowedIps)).toBe(true);
  });
});
