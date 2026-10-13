import type { MatchResult, TypeTarget } from "#tooling/lint/type-contracts.ts";
import { resolvedType } from "#tooling/lint/type-scopes.ts";
import { primitive, objectType, typeMembers } from "#tooling/lint/type-atoms.ts";

// unknownを受け入れるunionはany・unknown、または{}とnullとundefinedの組み合わせ。
// 空のinterfaceやvoidを{}・undefinedと同一視せず、未解決の合成型は不一致と断定しない。
export function acceptsUnknown(target: TypeTarget): MatchResult {
  const kinds = unknownTargetKinds(target);
  if (
    kinds.includes("top") ||
    ["non-nullish", "null", "undefined"].every((kind) => kinds.includes(kind))
  ) {
    return true;
  }

  return kinds.includes("unresolved") ? null : false;
}

function unknownTargetKinds(target: TypeTarget): string[] {
  const resolved = resolvedType(target);
  const node = resolved.type;
  if (!node || resolved.exact === false) {
    return ["unresolved"];
  }

  if (node.type === "TSUnionType") {
    return node.types.flatMap((type) => unknownTargetKinds({ ...resolved, type }));
  }

  const kinds = new Map([
    ["TSAnyKeyword", "top"],
    ["TSUnknownKeyword", "top"],
    ["TSNullKeyword", "null"],
    ["TSUndefinedKeyword", "undefined"],
    ["TSNeverKeyword", "concrete"],
  ]);
  const kind = kinds.get(node.type);
  if (kind) {
    return [kind];
  }

  if (node.type === "TSTypeLiteral" && typeMembers(node).length === 0) {
    return ["non-nullish"];
  }

  return primitive(node) || objectType({ ...resolved, type: node }) ? ["concrete"] : ["unresolved"];
}
