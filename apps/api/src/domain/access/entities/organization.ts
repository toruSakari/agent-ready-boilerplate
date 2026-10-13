import type { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import type { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { AllowedIpRange } from "#api/domain/access/value-objects/allowed-ip-range.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";

export const BUSINESS_IP_MAX_ENTRIES = 50;

export class OrganizationEntity {
  readonly businessAllowedIps: readonly AllowedIpRange[];

  constructor(
    readonly id: AccessId,
    readonly name: AccessName,
    readonly active: boolean,
    readonly invitationsEnabled: boolean,
    readonly businessIpRestrictionEnabled: boolean = false,
    businessAllowedIps: readonly AllowedIpRange[] = [],
  ) {
    if (businessAllowedIps.length > BUSINESS_IP_MAX_ENTRIES) {
      throw new InvalidValueObjectError(
        `許可IPは${BUSINESS_IP_MAX_ENTRIES}件以内で入力してください`,
      );
    }

    this.businessAllowedIps = Object.freeze([...new Set(businessAllowedIps)]);
    if (businessIpRestrictionEnabled && this.businessAllowedIps.length === 0) {
      throw new InvalidValueObjectError("IP制限を有効にするには許可IPを登録してください");
    }

    Object.freeze(this);
  }

  allowsBusinessIp(clientIp: string | null): boolean {
    return (
      !this.businessIpRestrictionEnabled ||
      this.businessAllowedIps.some((range) => AllowedIpRange.contains(range, clientIp))
    );
  }
}
