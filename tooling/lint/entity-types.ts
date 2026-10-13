import { referenceTarget, parameterEnvironment, typeArguments } from "#tooling/lint/type-scopes.ts";
import { provablyEmptyType } from "#tooling/lint/empty-types.ts";
import { conditionalBranches } from "#tooling/lint/conditional-types.ts";
import type { ESTree } from "vite-plus/lint/plugins";
import type {
  SeenTypes,
  TypeEnvironment,
  TypeNode,
  TypeTarget,
} from "#tooling/lint/type-contracts.ts";

function derivedReference(
  node: ESTree.TSTypeReference,
  environment: TypeEnvironment,
  seen: SeenTypes,
): boolean {
  const target = referenceTarget(node, environment, seen);
  if (target?.candidates) {
    return derivedAlternatives(target.candidates, target.seen);
  }

  if (target) {
    return derivedEntityType(target.type, target.environment, target.seen);
  }

  const name = node.typeName.type === "Identifier" ? node.typeName.name : undefined;
  if (name === environment.className) {
    return true;
  }

  if (name && environment.shadowed.has(name)) {
    return false;
  }

  return derivedUtility(name, typeArguments(node), environment, seen);
}

function derivedUtility(
  name: string | undefined,
  parameters: ESTree.TSType[],
  environment: TypeEnvironment,
  seen: SeenTypes,
): boolean {
  if (parameters.length !== 1) {
    return false;
  }

  if (name === "Readonly") {
    return derivedEntityType(parameters[0], environment, seen);
  }

  return (
    name === "InstanceType" &&
    parameters[0].type === "TSTypeQuery" &&
    parameters[0].exprName.type === "Identifier" &&
    parameters[0].exprName.name === environment.className
  );
}

// 型の中にクラス名があるだけでは合格にしない。公開型の各分岐がインスタンス型になる必要がある。
export function derivedEntityType(
  node: TypeNode | null | undefined,
  environment: TypeEnvironment,
  seen: SeenTypes = new Set(),
): boolean {
  switch (node?.type) {
    case "TSTypeReference":
      return derivedReference(node, environment, seen);
    case "TSUnionType":
      return derivedAlternatives(
        node.types.map((type) => ({ type, environment, seen })),
        seen,
      );
    case "TSIntersectionType":
      return derivedIntersection(node.types, environment, seen);
    case "TSParenthesizedType":
      return derivedEntityType(node.typeAnnotation, environment, seen);
    case "TSConditionalType":
      return derivedAlternatives(conditionalBranches(node, environment, seen), seen);
    case "TSIndexedAccessType":
      return derivedIndexedType(node.objectType, environment, seen);
    default:
      return false;
  }
}

function derivedIndexedType(
  node: TypeNode | null | undefined,
  environment: TypeEnvironment,
  seen: SeenTypes,
): boolean {
  if (node?.type === "TSTypeReference") {
    const target = referenceTarget(node, environment, seen);
    return target ? derivedIndexedType(target.type, target.environment, target.seen) : false;
  }

  if (node?.type === "TSParenthesizedType") {
    return derivedIndexedType(node.typeAnnotation, environment, seen);
  }

  return derivedIndexedMembers(node, environment, seen);
}

function derivedIndexedMembers(
  node: TypeNode | null | undefined,
  environment: TypeEnvironment,
  seen: SeenTypes,
): boolean {
  // 状態ごとのEntity<S>を選ぶTypestateの共用型を許可し、マップの値に混じる構造型は拒否する。
  if (node?.type === "TSMappedType") {
    return (
      node.optional !== true &&
      node.optional !== "+" &&
      derivedEntityType(node.typeAnnotation, parameterEnvironment(node, environment, seen), seen)
    );
  }

  if (node?.type === "TSTypeLiteral" && node.members.length > 0) {
    return node.members.every(
      (member) =>
        member.type === "TSPropertySignature" &&
        !member.optional &&
        derivedEntityType(member.typeAnnotation?.typeAnnotation, environment, seen),
    );
  }

  return false;
}

function derivedIntersection(
  branches: ESTree.TSType[],
  environment: TypeEnvironment,
  seen: SeenTypes,
): boolean {
  const derived = branches.map((branch) => derivedEntityType(branch, environment, seen));
  return (
    derived.some(Boolean) &&
    branches.every((branch, index) => derived[index] || additiveType(branch, environment, seen))
  );
}

function additiveType(
  node: TypeNode | null | undefined,
  environment: TypeEnvironment,
  seen: SeenTypes,
): boolean {
  switch (node?.type) {
    case "TSTypeLiteral":
    case "TSInterfaceBody":
    case "TSUnknownKeyword":
      return true;
    case "TSTypeReference": {
      const target = referenceTarget(node, environment, seen);
      return target ? additiveType(target.type, target.environment, target.seen) : false;
    }
    case "TSParenthesizedType":
      return additiveType(node.typeAnnotation, environment, seen);
    case "TSUnionType":
    case "TSIntersectionType":
      return node.types.every((branch) => additiveType(branch, environment, seen));
    default:
      return false;
  }
}

function derivedAlternatives(branches: TypeTarget[], seen: SeenTypes): boolean {
  const derived = branches.map((branch) =>
    derivedEntityType(branch.type, branch.environment, branch.seen ?? seen),
  );
  return (
    derived.some(Boolean) &&
    branches.every(
      (branch, index) =>
        derived[index] || emptyType(branch.type, branch.environment, branch.seen ?? seen),
    )
  );
}

function emptyType(
  node: TypeNode | null | undefined,
  environment: TypeEnvironment,
  seen: SeenTypes,
): boolean {
  switch (node?.type) {
    case "TSNeverKeyword":
      return true;
    case "TSIntersectionType":
      return provablyEmptyType({ type: node, environment, seen });
    case "TSTypeReference":
      return emptyReference(referenceTarget(node, environment, seen));
    case "TSParenthesizedType":
      return emptyType(node.typeAnnotation, environment, seen);
    case "TSUnionType":
      return node.types.every((branch) => emptyType(branch, environment, seen));
    case "TSConditionalType":
      // neverへの分配で分岐がなくなる場合も、条件型の結果は空になる。
      return conditionalBranches(node, environment, seen).every((branch) =>
        emptyType(branch.type, branch.environment, branch.seen ?? seen),
      );
    default:
      return false;
  }
}

function emptyReference(target: TypeTarget | null): boolean {
  if (target?.candidates) {
    return (
      target.candidates.length > 0 &&
      target.candidates.every((candidate) =>
        emptyType(candidate.type, candidate.environment, candidate.seen),
      )
    );
  }

  return target ? emptyType(target.type, target.environment, target.seen) : false;
}
