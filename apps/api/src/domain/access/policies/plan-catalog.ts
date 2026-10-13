import { PlanDefinition } from "#api/domain/access/entities/plan-definition.ts";
import {
  BUSINESS_PERMISSIONS,
  CUSTOMER_PERMISSIONS,
} from "#api/domain/access/policies/permission-catalog.ts";

export const DEMO_PLAN_CODES = Object.freeze({
  customer: "customer:demo",
  business: "business:demo",
});

/** 開発用seedが参照するプラン。料金体系や新規会員への自動割当は定義しない。 */
export const ACCESS_PLANS: readonly PlanDefinition[] = Object.freeze([
  PlanDefinition.create({
    code: DEMO_PLAN_CODES.customer,
    name: "通常会員デモ",
    category: "customer",
    permissions: CUSTOMER_PERMISSIONS,
  }),
  PlanDefinition.create({
    code: DEMO_PLAN_CODES.business,
    name: "企業デモ",
    category: "business",
    permissions: BUSINESS_PERMISSIONS,
  }),
]);
