// コンパイル時だけの契約検査。本番コードからはインポートしない。
import type { AllowedIpRange } from "#api/domain/access/value-objects/allowed-ip-range.ts";
import type { OrganizationEntity } from "#api/domain/access/entities/organization.ts";

type Assert<T extends true> = T;

type Assignable<Source, Target> = [Source] extends [Target] ? true : false;

export type AllowedIpRangeContracts = [
  Assert<Assignable<AllowedIpRange, string>>,
  Assert<Assignable<string, AllowedIpRange> extends false ? true : false>,
  Assert<
    Assignable<string[], OrganizationEntity["businessAllowedIps"]> extends false ? true : false
  >,
];
