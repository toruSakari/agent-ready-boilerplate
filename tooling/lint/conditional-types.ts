import { inferredParameters, resolvedType } from "#tooling/lint/type-scopes.ts";
import { matchType } from "#tooling/lint/type-patterns.ts";
import { unionMembers } from "#tooling/lint/type-atoms.ts";
import { provablyEmptyType } from "#tooling/lint/empty-types.ts";
import type { ESTree } from "vite-plus/lint/plugins";
import type {
  InferredCandidates,
  SeenTypes,
  TypeEnvironment,
  TypeTarget,
} from "#tooling/lint/type-contracts.ts";

function inferredEnvironment(
  node: ESTree.TSConditionalType,
  environment: TypeEnvironment,
  seen: SeenTypes,
  candidates: InferredCandidates,
): TypeEnvironment {
  const scope = { ...environment, parameters: new Map(environment.parameters) };
  for (const parameter of inferredParameters(node.extendsType)) {
    const name = parameter.name.name;
    scope.parameters.set(name, {
      type: null,
      environment: scope,
      seen,
      exact: true,
      candidates: candidates.get(name) ?? [],
    });
  }

  return scope;
}

function branchFor(
  node: ESTree.TSConditionalType,
  source: TypeTarget,
  environment: TypeEnvironment,
  seen: SeenTypes,
): TypeTarget[] {
  const candidates: InferredCandidates = new Map();
  const result = matchType(source, { type: node.extendsType, environment, seen }, candidates);
  const branches: TypeTarget[] = [];
  if (result !== false) {
    branches.push({
      type: node.trueType,
      environment: inferredEnvironment(node, environment, seen, candidates),
      seen,
    });
  }

  if (result !== true) {
    branches.push({ type: node.falseType, environment, seen });
  }

  return branches;
}

export function conditionalBranches(
  node: ESTree.TSConditionalType,
  environment: TypeEnvironment,
  seen: SeenTypes,
): TypeTarget[] {
  const source = { type: node.checkType, environment, seen };
  const resolved = resolvedType(source);
  const name =
    node.checkType.type === "TSTypeReference" && node.checkType.typeName.type === "Identifier"
      ? node.checkType.typeName.name
      : null;
  const parameter = name === null ? undefined : environment.parameters?.get(name);
  // 裸の型パラメーターだけが分配される。制約だけでは具体的な分岐を確定しない。
  return parameter && name !== null && resolved.exact !== false
    ? distributedBranches(node, resolved, environment, seen, name)
    : branchFor(node, source, environment, seen);
}

function distributedBranches(
  node: ESTree.TSConditionalType,
  source: TypeTarget,
  environment: TypeEnvironment,
  seen: SeenTypes,
  parameterName: string,
): TypeTarget[] {
  const resolved = resolvedType(source);
  if (provablyEmptyType(resolved)) {
    return [];
  }

  const members = unionMembers(resolved.type);
  if (members) {
    return members.flatMap((type) =>
      distributedBranches(node, { ...resolved, type }, environment, seen, parameterName),
    );
  }

  // 分岐内でも同じ型引数を参照するため、選んだ構成要素をパラメーターへ束縛する。
  const scope = { ...environment, parameters: new Map(environment.parameters) };
  scope.parameters.set(parameterName, resolved);
  return branchFor(node, resolved, scope, seen);
}
