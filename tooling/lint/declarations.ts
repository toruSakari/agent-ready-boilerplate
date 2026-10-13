import type { ESTree } from "vite-plus/lint/plugins";

export type NamedDeclaration = Extract<ESTree.Node, { id: unknown }> & {
  id: ESTree.BindingIdentifier;
};

export interface ExportBinding {
  name?: string;
  local?: string;
  declaration?: NamedDeclaration | null;
  source?: ESTree.StringLiteral | null;
  node: ESTree.Node;
  typeOnly: boolean;
  valueOnly?: boolean;
  expression?: ESTree.Node;
  all?: boolean;
}

export interface DeclarationBindings {
  declarations: Map<string, NamedDeclaration[]>;
  exports: ExportBinding[];
}

function expressionWrapper(
  node: ESTree.Node,
): node is
  | ESTree.TSAsExpression
  | ESTree.TSTypeAssertion
  | ESTree.TSSatisfiesExpression
  | ESTree.TSNonNullExpression {
  return (
    node.type === "TSAsExpression" ||
    node.type === "TSTypeAssertion" ||
    node.type === "TSSatisfiesExpression" ||
    node.type === "TSNonNullExpression"
  );
}

function namedDeclaration<T extends ESTree.Node>(node: T): node is T & NamedDeclaration {
  return "id" in node && node.id?.type === "Identifier";
}

// 公開名とローカル定義を分け、後置export・別名export・宣言のマージも同じ方法で調べる。
export function declarationsAndExports(program: ESTree.Program): DeclarationBindings {
  const declarations = new Map<string, NamedDeclaration[]>();
  const exports: ExportBinding[] = [];
  for (const statement of program.body) {
    const declaration = "declaration" in statement ? statement.declaration : null;
    const items = declaredItems(declaration ?? statement);
    for (const item of items) {
      const name = item.id.name;
      declarations.set(name, [...(declarations.get(name) ?? []), item]);
    }

    exports.push(...exportedBindings(statement, items));
  }

  return { declarations, exports };
}

function exportedBindings(statement: ESTree.Node, items: NamedDeclaration[]): ExportBinding[] {
  if (statement.type === "ExportAllDeclaration") {
    return [starBinding(statement)];
  }

  if (statement.type === "ExportNamedDeclaration") {
    const direct = items.map((item) => ({
      name: item.id.name,
      local: item.id.name,
      declaration: item,
      node: item,
      typeOnly: statement.exportKind === "type",
    }));
    const later = statement.specifiers.map((item) => ({
      name: item.exported.type === "Identifier" ? item.exported.name : item.exported.value,
      local: item.local.type === "Identifier" ? item.local.name : undefined,
      source: statement.source,
      node: item,
      typeOnly: statement.exportKind === "type" || item.exportKind === "type",
    }));
    return [...direct, ...later];
  }

  if (statement.type === "ExportDefaultDeclaration") {
    const declaration = unwrapExpression(statement.declaration);
    const named = namedDeclaration(declaration) ? declaration : null;
    const local = named?.id.name ?? (declaration.type === "Identifier" ? declaration.name : null);
    return local
      ? [
          {
            name: "default",
            local,
            declaration: named,
            valueOnly: declaration.type === "Identifier",
            typeOnly: false,
            expression: statement.declaration,
            node: statement,
          },
        ]
      : [];
  }

  return [];
}

function starBinding(statement: ESTree.ExportAllDeclaration): ExportBinding {
  const exported = statement.exported;
  return {
    name: exported?.type === "Identifier" ? exported.name : exported?.value,
    all: !exported,
    source: statement.source,
    node: statement,
    typeOnly: statement.exportKind === "type",
  };
}

function declaredItems(node: ESTree.Node): NamedDeclaration[] {
  if (node.type === "VariableDeclaration") {
    return node.declarations.filter(namedDeclaration);
  }

  return namedDeclaration(node) ? [node] : [];
}

export function exportedDeclarations(
  bindings: DeclarationBindings,
  exports = bindings.exports,
): NamedDeclaration[] {
  return exports.flatMap((binding) => {
    if (binding.source) {
      return [];
    }

    const localNodes = binding.local ? (bindings.declarations.get(binding.local) ?? []) : [];
    const nodes = binding.declaration ? [binding.declaration] : localNodes;
    return binding.valueOnly
      ? nodes.filter(
          (node) =>
            node.type !== "TSTypeAliasDeclaration" && node.type !== "TSInterfaceDeclaration",
        )
      : nodes;
  });
}

export function unwrapExpression(node: ESTree.Node): ESTree.Node;
export function unwrapExpression(
  node: ESTree.Node | null | undefined,
): ESTree.Node | null | undefined;

export function unwrapExpression(
  node: ESTree.Node | null | undefined,
): ESTree.Node | null | undefined {
  return node && expressionWrapper(node) ? unwrapExpression(node.expression) : node;
}

export function classNames(node: ESTree.Class): string[] {
  let outer: ESTree.Node = node;
  while (outer.parent && expressionWrapper(outer.parent)) {
    outer = outer.parent;
  }

  const parent = outer.parent;
  const binding =
    parent?.type === "VariableDeclarator" && parent.id.type === "Identifier"
      ? parent.id.name
      : undefined;
  return [...new Set([node.id?.name, binding].filter((name) => name !== undefined))];
}

export function publishedClasses(program: ESTree.Program) {
  const bindings = declarationsAndExports(program);
  return bindings.exports.flatMap((binding) => {
    if (binding.typeOnly) {
      return [];
    }

    return exportedDeclarations(bindings, [binding]).flatMap((declaration) => {
      const expression =
        declaration.type === "VariableDeclarator" ? (declaration.init ?? declaration) : declaration;
      const node = unwrapExpression(expression);
      if ((node.type !== "ClassDeclaration" && node.type !== "ClassExpression") || node.declare) {
        return [];
      }

      const name = binding.name === "default" ? declaration.id.name : binding.name;
      return [{ name, node, expression: binding.expression ?? expression }];
    });
  });
}
