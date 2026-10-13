import type { RouterOutputs } from "@dev-template/api-types";

// 共通UIが扱うのはAPI出力の表現。サーバーの会員集約やブランド型を再公開しない。
export type AccessSession = RouterOutputs["access"]["session"];

export type Permission = AccessSession["permissions"][number];

export type AccessRole = RouterOutputs["access"]["roles"][number];

export type AccessMember = RouterOutputs["access"]["members"][number];

export type ServiceRegistration = RouterOutputs["access"]["registration"];

export type ServiceCategory = ServiceRegistration["category"];
