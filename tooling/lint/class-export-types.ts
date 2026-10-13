import type { ESTree } from "vite-plus/lint/plugins";
import type {
  TypeNode,
  TypeEnvironment,
  TypeTarget,
  SeenTypes,
} from "#tooling/lint/type-contracts.ts";

import { typeMembers } from "#tooling/lint/type-atoms.ts";
import { derivedEntityType } from "#tooling/lint/entity-types.ts";
import { parameterEnvironment } from "#tooling/lint/type-scopes.ts";
import { constructorTarget, heritageTarget } from "#tooling/lint/class-type-references.ts";
import { compatibleStaticMembers } from "#tooling/lint/class-static-members.ts";

type ConstructorKind = "constructor" | "neutral" | "empty" | "erased";

export function preservesClassExport(
  expression: ESTree.Node,
  environment: TypeEnvironment,
  nonNullable = false,
): boolean {
  if (expression.type === "TSNonNullExpression") {
    return preservesClassExport(expression.expression, environment, true);
  }

  if (expression.type === "TSSatisfiesExpression") {
    return preservesClassExport(expression.expression, environment, nonNullable);
  }

  if (expression.type === "TSAsExpression" || expression.type === "TSTypeAssertion") {
    // 外側のアサーションが公開型を決める。内側のunknownからtypeofへ戻す形も許可する。
    return (
      constructorKind(expression.typeAnnotation, environment, new Set(), nonNullable) ===
      "constructor"
    );
  }

  return true;
}

function constructorKind(
  node: TypeNode | null | undefined,
  environment: TypeEnvironment,
  seen: SeenTypes,
  nonNullable: boolean,
): ConstructorKind {
  if (!node) {
    return "erased";
  }

  switch (node.type) {
    case "TSTypeReference":
      return referencedConstructor(constructorTarget(node, environment, seen), nonNullable);
    case "TSParenthesizedType":
      return constructorKind(node.typeAnnotation, environment, seen, nonNullable);
    case "TSUnionType":
      return unionConstructor(node.types, environment, seen, nonNullable);
    case "TSIntersectionType":
      return intersectionConstructor(node.types, environment, seen, nonNullable);
    default:
      return constructorShape(node, environment, seen, nonNullable);
  }
}

function constructorShape(
  node: TypeNode,
  environment: TypeEnvironment,
  seen: SeenTypes,
  nonNullable: boolean,
): ConstructorKind {
  switch (node.type) {
    case "TSTypeQuery":
      return node.exprName.type === "Identifier" && node.exprName.name === environment.className
        ? "constructor"
        : "erased";
    case "TSConstructorType":
      return entityConstructor(node, environment, seen) ? "constructor" : "erased";
    case "TSTypeLiteral":
    case "TSInterfaceBody":
      return signatureConstructor(node, environment, seen);
    default:
      return emptyConstructor(node, nonNullable);
  }
}

function emptyConstructor(node: TypeNode, nonNullable: boolean): ConstructorKind {
  if (["TSObjectKeyword", "TSUnknownKeyword"].includes(node.type)) {
    return "neutral";
  }

  if (node.type === "TSNeverKeyword") {
    return "empty";
  }

  const nullish = ["TSNullKeyword", "TSUndefinedKeyword"].includes(node.type);
  return nullish && nonNullable ? "empty" : "erased";
}

function referencedConstructor(target: TypeTarget | null, nonNullable: boolean): ConstructorKind {
  if (!target) {
    return "erased";
  }

  if (target.targets) {
    return mergedConstructor(target.targets, nonNullable);
  }

  if (target.incomplete) {
    return inheritedConstructor(target, nonNullable);
  }

  return constructorKind(
    target.type,
    target.environment,
    target.seen,
    nonNullable || target.nonNullable === true,
  );
}

function inheritedConstructor(target: TypeTarget | null, nonNullable: boolean): ConstructorKind {
  if (!target?.type) {
    return "erased";
  }

  nonNullable ||= target.nonNullable === true;
  if (target.targets) {
    return mergedConstructor(target.targets, nonNullable);
  }

  const { type, environment, seen } = target;
  if (type.type === "TSTypeReference") {
    return inheritedConstructor(constructorTarget(type, environment, seen), nonNullable);
  }

  if (type.type === "TSParenthesizedType") {
    return inheritedConstructor({ ...target, type: type.typeAnnotation }, nonNullable);
  }

  if (!["TSTypeLiteral", "TSInterfaceBody"].includes(type.type)) {
    return constructorKind(type, environment, seen, nonNullable);
  }

  const own = signatureConstructor(type, environment, seen);
  const bases =
    target.declaration?.type === "TSInterfaceDeclaration" ? target.declaration.extends : [];
  const kinds = [
    own,
    ...bases.map((node) =>
      inheritedConstructor(heritageTarget(node, environment, seen), nonNullable),
    ),
  ];
  return combinedConstructor(kinds);
}

function mergedConstructor(targets: TypeTarget[], nonNullable: boolean): ConstructorKind {
  return combinedConstructor(targets.map((target) => inheritedConstructor(target, nonNullable)));
}

function combinedConstructor(kinds: ConstructorKind[]): ConstructorKind {
  // interfaceのマージ・継承では全宣言の構築シグネチャを確認し、未知の基底型や非Entityの戻り値は拒否する。
  if (kinds.some((kind) => !["constructor", "neutral"].includes(kind))) {
    return "erased";
  }

  return kinds.includes("constructor") ? "constructor" : "neutral";
}

function entityConstructor(
  node: ESTree.TSConstructorType | ESTree.TSConstructSignatureDeclaration,
  environment: TypeEnvironment,
  seen: SeenTypes,
): boolean {
  if ("abstract" in node && node.abstract) {
    return false;
  }

  const scope = (node.typeParameters?.params ?? []).reduce(
    (current, parameter) => parameterEnvironment(parameter, current, seen),
    environment,
  );
  return derivedEntityType(node.returnType?.typeAnnotation, scope, seen);
}

function signatureConstructor(
  node: TypeNode,
  environment: TypeEnvironment,
  seen: SeenTypes,
): ConstructorKind {
  const members = typeMembers(node);
  const signatures = members.filter((member) => member.type === "TSConstructSignatureDeclaration");
  // 構築シグネチャのない型は追加メンバーとして扱い、単独の公開型としては許可しない。
  if (signatures.length === 0) {
    return "neutral";
  }

  return signatures.every((member) => entityConstructor(member, environment, seen))
    ? "constructor"
    : "erased";
}

function unionConstructor(
  types: ESTree.TSType[],
  environment: TypeEnvironment,
  seen: SeenTypes,
  nonNullable: boolean,
): ConstructorKind {
  const kinds = types.map((node) => constructorKind(node, environment, seen, nonNullable));
  if (kinds.some((kind) => !["constructor", "empty"].includes(kind))) {
    return "erased";
  }

  return kinds.includes("constructor") ? "constructor" : "empty";
}

function intersectionConstructor(
  types: ESTree.TSType[],
  environment: TypeEnvironment,
  seen: SeenTypes,
  nonNullable: boolean,
): ConstructorKind {
  const kinds = types.map((node) => constructorKind(node, environment, seen, nonNullable));
  if (kinds.includes("empty")) {
    return "empty";
  }

  if (kinds.includes("erased")) {
    return "erased";
  }

  if (!compatibleStaticMembers(types, environment, seen)) {
    return "erased";
  }

  // 全シグネチャが具象Entityを返す交差型は、構築オーバーロードとして公開できる。
  return kinds.includes("constructor") ? "constructor" : "neutral";
}
