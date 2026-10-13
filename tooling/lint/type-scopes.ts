import type { ESTree } from "vite-plus/lint/plugins";
import type {
  MergedInterface,
  ParameterBinding,
  SeenTypes,
  TypeDeclaration,
  TypeEnvironment,
  TypeNode,
  TypeTarget,
} from "#tooling/lint/type-contracts.ts";

export function typeArguments(node: TypeNode): ESTree.TSType[] {
  return "typeArguments" in node ? (node.typeArguments?.params ?? []) : [];
}

// 宣言の型パラメーターは、その宣言自身のスコープで解決する。既定値は公開型の制約にはしない。
export function aliasEnvironment(
  declaration: ESTree.Node,
  environment: TypeEnvironment,
  seen: SeenTypes,
  arguments_: ESTree.TSType[] | null = null,
  callerSeen = seen,
): TypeEnvironment {
  const scope = { ...environment, parameters: new Map<string, ParameterBinding>() };
  const parameters = "typeParameters" in declaration ? declaration.typeParameters?.params : [];
  for (const [index, parameter] of (parameters ?? []).entries()) {
    scope.parameters.set(
      parameter.name.name,
      parameterBinding({
        parameter,
        scope,
        environment,
        seen,
        argument: arguments_?.[index],
        instantiated: arguments_ !== null,
        callerSeen,
      }),
    );
  }

  return scope;
}

interface ParameterBindingProps {
  parameter: ESTree.TSTypeParameter;
  scope: TypeEnvironment;
  environment: TypeEnvironment;
  seen: SeenTypes;
  argument: ESTree.TSType | undefined;
  instantiated: boolean;
  callerSeen: SeenTypes;
}

function parameterBinding(props: ParameterBindingProps): ParameterBinding {
  if (props.argument) {
    return {
      type: props.argument,
      environment: props.environment,
      seen: props.callerSeen,
      exact: true,
    };
  }

  return {
    type: props.instantiated
      ? (props.parameter.default ?? props.parameter.constraint)
      : props.parameter.constraint,
    environment: props.scope,
    seen: props.seen,
    exact: props.instantiated,
  };
}

export function parameterEnvironment(
  parameter: ESTree.TSMappedType | ESTree.TSTypeParameter,
  environment: TypeEnvironment,
  seen: SeenTypes,
): TypeEnvironment {
  const scope = { ...environment, parameters: new Map(environment.parameters) };
  const name = parameter.type === "TSMappedType" ? parameter.key.name : parameter.name.name;
  scope.parameters.set(name, { type: parameter.constraint, environment: scope, seen });
  return scope;
}

export function referenceTarget(
  node: ESTree.TSTypeReference,
  environment: TypeEnvironment,
  seen: SeenTypes,
): TypeTarget | null {
  if (node.typeName.type !== "Identifier") {
    return null;
  }

  const name = node.typeName.name;
  const parameter = environment.parameters?.get(name);
  if (parameter) {
    return parameterTarget(parameter, environment, seen);
  }

  const alias = environment.aliases.get(name);
  if (!environment.aliases.has(name)) {
    return null;
  }

  if (!alias || seen.has(name)) {
    return { type: null, environment, seen };
  }

  const next = new Set([...seen, name]);
  return aliasTarget(alias, environment, next, typeArguments(node), seen);
}

function aliasTarget(
  alias: TypeDeclaration | MergedInterface,
  environment: TypeEnvironment,
  seen: SeenTypes,
  arguments_: ESTree.TSType[],
  callerSeen: SeenTypes,
): TypeTarget {
  if ("mergedDeclarations" in alias) {
    return mergedTarget(alias, environment, seen, arguments_, callerSeen);
  }

  return {
    type: alias.type === "TSTypeAliasDeclaration" ? alias.typeAnnotation : alias.body,
    declaration: alias,
    environment: aliasEnvironment(alias, environment, seen, arguments_, callerSeen),
    seen,
    incomplete: alias.type === "TSInterfaceDeclaration" && alias.extends.length > 0,
  };
}

function mergedTarget(
  alias: MergedInterface,
  environment: TypeEnvironment,
  seen: SeenTypes,
  arguments_: ESTree.TSType[],
  callerSeen: SeenTypes,
): TypeTarget {
  const declarations = alias.mergedDeclarations;
  const scopes = new Map(
    declarations.map((declaration) => [
      declaration,
      { ...environment, parameters: new Map<string, ParameterBinding>() },
    ]),
  );
  const bindings = alias.mergedParameters.map((parameter, index): ParameterBinding => {
    if (arguments_[index]) {
      return { type: arguments_[index], environment, seen: callerSeen, exact: true };
    }

    const source = parameter.default ?? parameter.constraint;
    return {
      type: source?.type,
      environment: source ? (scopes.get(source.declaration) ?? environment) : environment,
      seen,
      exact: true,
    };
  });
  for (const [declaration, scope] of scopes) {
    (declaration.typeParameters?.params ?? []).forEach((parameter, index) => {
      scope.parameters.set(parameter.name.name, bindings[index]);
    });
  }

  const targets = [...scopes].map((entry) => ({
    type: entry[0].body,
    declaration: entry[0],
    environment: entry[1],
    seen,
    incomplete: entry[0].extends.length > 0,
  }));
  return {
    type: alias.body,
    environment: targets[0].environment,
    seen,
    targets,
    // 宣言ごとに型引数のスコープが異なる場合、構造型の推論では一つの環境へ潰さない。
    incomplete: targets.some(
      (target) => target.incomplete || target.environment.parameters.size !== bindings.length,
    ),
  };
}

function parameterTarget(
  parameter: ParameterBinding,
  environment: TypeEnvironment,
  seen: SeenTypes,
): TypeTarget {
  if (seen.has(parameter)) {
    return { type: null, environment, seen };
  }

  // 実引数へ戻るときは呼出元の宣言スコープを使い、同じジェネリックの入れ子も区別する。
  const visited = [...seen].filter((item) => typeof item !== "string");
  const next = new Set([...parameter.seen, ...visited, parameter]);
  return {
    type: parameter.type,
    environment: parameter.environment,
    seen: next,
    exact: parameter.exact,
    identity: parameter.exact === true ? null : parameter,
    candidates: parameter.candidates?.map((candidate) => ({
      ...candidate,
      seen: new Set([...candidate.seen, ...next]),
    })),
  };
}

export function inferredParameters(node: unknown): ESTree.TSTypeParameter[] {
  if (!isAstNode(node)) {
    return [];
  }

  if (node?.type === "TSInferType") {
    return [node.typeParameter];
  }

  const entries: [string, unknown][] = Object.entries(node);
  return entries
    .filter((entry) => entry[0] !== "parent")
    .flatMap((entry) => {
      const children = Array.isArray(entry[1]) ? entry[1] : [entry[1]];
      return children.flatMap(inferredParameters);
    });
}

// 子要素の列挙境界だけを絞り込み、以降はパーサー由来の判別可能な共用型を保つ。
function isAstNode(node: unknown): node is ESTree.Node {
  return (
    typeof node === "object" && node !== null && "type" in node && typeof node.type === "string"
  );
}

// 制約は候補の上限であり、具体的な実引数ではない。分岐の確定には使わない。
export function resolvedType(target: TypeTarget): TypeTarget {
  const node = target.type;
  if (node?.type === "TSParenthesizedType") {
    return resolvedType({ ...target, type: node.typeAnnotation });
  }

  if (node?.type !== "TSTypeReference") {
    return target;
  }

  const next = referenceTarget(node, target.environment, target.seen);
  if (!next) {
    return target;
  }

  if (next.candidates?.length === 1) {
    return resolvedType({ ...next.candidates[0], exact: target.exact !== false });
  }

  return resolvedType({
    ...next,
    exact: target.exact !== false && next.exact !== false,
    identity: target.identity ?? next.identity,
  });
}
