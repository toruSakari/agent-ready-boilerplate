import type { ESTree } from "vite-plus/lint/plugins";
import type { PresentTarget, TypeTarget } from "#tooling/lint/type-contracts.ts";
import { primitive } from "#tooling/lint/type-atoms.ts";
import { resolvedType } from "#tooling/lint/type-scopes.ts";

type TemplateState = "empty" | "inhabited" | null;

// 補間の全展開はせず、空集合か文字列を少なくとも一つ持つかだけを共有する。
export function templateState(target: TypeTarget): TemplateState {
  if (target.type?.type !== "TSTemplateLiteralType") {
    return null;
  }

  const states = target.type.types.map((type) => spanState({ ...target, type }));
  if (states.includes("empty")) {
    return "empty";
  }

  return states.every((state) => state === "inhabited") ? "inhabited" : null;
}

function spanState(target: TypeTarget): TemplateState {
  const resolved = resolvedType(target);
  if (resolved.exact === false || !resolved.type) {
    return null;
  }

  if (resolved.type.type === "TSNeverKeyword") {
    return "empty";
  }

  if (resolved.type.type === "TSUnionType") {
    return unionState({ ...resolved, type: resolved.type });
  }

  if (resolved.type.type === "TSTemplateLiteralType") {
    return templateState(resolved);
  }

  const kind = primitive(resolved.type)?.kind;
  const inhabited = ["string", "number", "bigint", "boolean", "null", "undefined"].includes(
    kind ?? "",
  );
  return inhabited || resolved.type.type === "TSAnyKeyword" ? "inhabited" : null;
}

function unionState(target: PresentTarget<ESTree.TSUnionType>): TemplateState {
  const states = target.type.types.map((type) => spanState({ ...target, type }));
  if (states.includes("inhabited")) {
    return "inhabited";
  }

  return states.every((state) => state === "empty") ? "empty" : null;
}

export function sameTemplate(
  source: PresentTarget,
  pattern: PresentTarget,
  compare: (source: TypeTarget, pattern: TypeTarget) => boolean,
): boolean {
  if (
    source.type.type !== "TSTemplateLiteralType" ||
    pattern.type.type !== "TSTemplateLiteralType"
  ) {
    return false;
  }

  const actual = source.type;
  const expected = pattern.type;
  return (
    actual.quasis.length === expected.quasis.length &&
    actual.quasis.every(
      (quasi, index) => quasi.value.cooked === expected.quasis[index].value.cooked,
    ) &&
    actual.types.every((type, index) =>
      compare({ ...source, type }, { ...pattern, type: expected.types[index] }),
    )
  );
}
