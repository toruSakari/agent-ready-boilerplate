import type { ESTree } from "vite-plus/lint/plugins";
import type { TypeEnvironment, TypeTarget, SeenTypes } from "#tooling/lint/type-contracts.ts";
import { referenceTarget, typeArguments } from "#tooling/lint/type-scopes.ts";

export function constructorTarget(
  node: ESTree.TSTypeReference,
  environment: TypeEnvironment,
  seen: SeenTypes,
): TypeTarget | null {
  const target = referenceTarget(node, environment, seen);
  const name = node.typeName.type === "Identifier" ? node.typeName.name : undefined;
  const arguments_ = typeArguments(node);
  // 組込みだけを扱い、同名の宣言・import・型パラメーターの意味を上書きしない。
  if (
    target ||
    name !== "NonNullable" ||
    environment.shadowed?.has(name) ||
    environment.localTypes?.has(name) ||
    arguments_.length !== 1
  ) {
    return target;
  }

  return { type: arguments_[0], environment, seen, nonNullable: true };
}

export function heritageTarget(
  node: ESTree.TSInterfaceHeritage,
  environment: TypeEnvironment,
  seen: SeenTypes,
): TypeTarget | null {
  if (node.expression.type !== "Identifier") {
    return null;
  }

  return constructorTarget(
    { ...node, type: "TSTypeReference", typeName: node.expression },
    environment,
    seen,
  );
}
