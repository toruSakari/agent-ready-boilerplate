import type { ESTree } from "vite-plus/lint/plugins";
import type {
  MergedInterface,
  MergedParameter,
  ParameterSource,
  TypeDeclaration,
} from "#tooling/lint/type-contracts.ts";

function parameterName(parameter: ESTree.TSTypeParameter): string {
  return parameter.name.name;
}

function parameters(declaration: TypeDeclaration): ESTree.TSTypeParameter[] {
  return declaration.typeParameters?.params ?? [];
}

// interfaceのマージは宣言を失わず保持する。型引数を追加した宣言のスコープを既存宣言へ持ち込まない。
export function typeDeclarations(
  nodes: ESTree.Node[],
): TypeDeclaration | MergedInterface | null | undefined {
  const declarations = nodes.filter(
    (node) => node.type === "TSTypeAliasDeclaration" || node.type === "TSInterfaceDeclaration",
  );
  if (declarations.length < 2) {
    return declarations[0];
  }

  if (!declarations.every((node) => node.type === "TSInterfaceDeclaration")) {
    return null;
  }

  const bindings = mergedParameters(declarations);
  if (!bindings) {
    return null;
  }

  return {
    ...declarations[0],
    body: {
      ...declarations[0].body,
      body: declarations.flatMap((node) => node.body.body),
    },
    mergedDeclarations: declarations,
    mergedParameters: bindings,
  };
}

function mergedParameters(declarations: ESTree.TSInterfaceDeclaration[]): MergedParameter[] | null {
  const bindings: MergedParameter[] = [];
  for (const declaration of declarations) {
    for (const [index, parameter] of parameters(declaration).entries()) {
      const binding = (bindings[index] ??= { name: parameterName(parameter) });
      if (!mergeParameter(binding, parameter, declaration)) {
        return null;
      }
    }
  }

  const required = Math.min(...declarations.map((node) => parameters(node).length));
  // 既存宣言にない型引数は既定値を伴う場合にだけ追加できる。
  return bindings.slice(required).every((binding) => binding.default) ? bindings : null;
}

function mergeParameter(
  binding: MergedParameter,
  parameter: ESTree.TSTypeParameter,
  declaration: ESTree.TSInterfaceDeclaration,
): boolean {
  if (binding.name !== parameterName(parameter)) {
    return false;
  }

  const keys: ("constraint" | "default")[] = ["constraint", "default"];
  for (const key of keys) {
    if (!parameter[key]) {
      continue;
    }

    const current = { type: parameter[key], declaration };
    if (binding[key] && !sameBinding(binding[key], current)) {
      return false;
    }

    binding[key] ??= current;
  }

  return true;
}

function sameBinding(left: ParameterSource, right: ParameterSource): boolean {
  if (!sameSyntax(left.type, right.type)) {
    return false;
  }

  const leftNames = new Set(parameters(left.declaration).map(parameterName));
  const rightNames = new Set(parameters(right.declaration).map(parameterName));
  return references(left.type).every((name) => leftNames.has(name) === rightNames.has(name));
}

function references(node: unknown): string[] {
  if (!node || typeof node !== "object") {
    return [];
  }

  const name = referenceName(node);
  const own = name ? [name] : [];
  return [...own, ...syntaxEntries(node).flatMap((entry) => references(entry[1]))];
}

function referenceName(node: object): string | null {
  if (!("type" in node) || node.type !== "TSTypeReference" || !("typeName" in node)) {
    return null;
  }

  const name = node.typeName;
  return name && typeof name === "object" && "name" in name && typeof name.name === "string"
    ? name.name
    : null;
}

function sameSyntax(left: unknown, right: unknown): boolean {
  if (left === right) {
    return true;
  }

  if (!left || !right || typeof left !== "object" || typeof right !== "object") {
    return false;
  }

  const entries = syntaxEntries(left);
  const otherEntries = new Map(syntaxEntries(right));
  return (
    entries.length === otherEntries.size &&
    entries.every((entry) => sameSyntax(entry[1], otherEntries.get(entry[0])))
  );
}

function syntaxEntries(node: object): [string, unknown][] {
  return Object.entries(node).filter(
    (entry) => !["parent", "start", "end", "range", "loc", "raw"].includes(entry[0]),
  );
}
