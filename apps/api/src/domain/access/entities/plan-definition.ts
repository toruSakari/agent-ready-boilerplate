import { ACCESS_LIMITS } from "#api/domain/access/policies/access-limits.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";
import { AccessName } from "#api/domain/access/value-objects/access-name.ts";
import { PermissionValue } from "#api/domain/access/value-objects/permission.ts";
import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";
import { isRecord } from "#api/domain/shared/validation.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";

import type { PermissionCode } from "#api/domain/access/policies/permission-catalog.ts";
import type { Permission } from "#api/domain/access/value-objects/permission.ts";
import type { PlanCategory } from "#api/domain/access/policies/plan-permission-policy.ts";

export type PlanDefinitionSnapshot = Readonly<{
  code: string;
  name: string;
  category: PlanCategory;
  permissions: readonly PermissionCode[];
}>;

export class PlanDefinition {
  private constructor(
    readonly code: AccessId,
    readonly name: AccessName,
    readonly category: PlanCategory,
    readonly permissions: readonly Permission[],
  ) {
    Object.freeze(this);
  }

  static create(value: unknown): PlanDefinition {
    if (!isRecord(value)) {
      throw new InvalidValueObjectError("プランの定義が不正です");
    }

    if (value.category !== "customer" && value.category !== "business") {
      throw new InvalidValueObjectError("プランの対象サービスが不正です");
    }

    if (
      !Array.isArray(value.permissions) ||
      value.permissions.length > ACCESS_LIMITS.permissionsMaxCount
    ) {
      throw new InvalidValueObjectError("プランの権限一覧が不正です");
    }

    try {
      const code = AccessId.create(value.code);
      const name = AccessName.create(value.name);
      const permissions = [
        ...new Set(value.permissions.map((permission) => PermissionValue.create(permission))),
      ];
      // プラン定義そのものにもサービス上限を適用し、別サービスの権限混入を拒否する。
      const ceiling = value.category === "customer" ? CUSTOMER_PERMISSIONS : BUSINESS_PERMISSIONS;
      if (permissions.some((permission) => !ceiling.includes(permission))) {
        throw new InvalidValueObjectError("プランに対象サービス外の権限は設定できません");
      }

      return new PlanDefinition(code, name, value.category, Object.freeze(permissions));
    } catch (error) {
      if (error instanceof InvalidValueObjectError) {
        throw error;
      }

      throw new InvalidValueObjectError("プランの定義が不正です");
    }
  }

  toSnapshot(): PlanDefinitionSnapshot {
    return {
      code: this.code,
      name: this.name,
      category: this.category,
      permissions: this.permissions,
    };
  }
}
