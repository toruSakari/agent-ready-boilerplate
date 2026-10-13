import type { Context, ESTree } from "vite-plus/lint/plugins";
import type {
  DeclarationBindings,
  ExportBinding,
  NamedDeclaration,
} from "#tooling/lint/declarations.ts";
import type {
  TypeEnvironment,
  TypeDeclaration,
  MergedInterface,
} from "#tooling/lint/type-contracts.ts";
import { aliasEnvironment } from "#tooling/lint/type-scopes.ts";
import { typeDeclarations } from "#tooling/lint/type-declarations.ts";
import { defineRule } from "vite-plus/lint/plugins";
import {
  declarationsAndExports,
  publishedClasses,
  exportedDeclarations,
} from "#tooling/lint/declarations.ts";
import { derivedEntityType } from "#tooling/lint/entity-types.ts";
import { preservesClassExport } from "#tooling/lint/class-export-types.ts";

function typeEnvironment(
  program: ESTree.Program,
  declarations: Map<string, NamedDeclaration[]>,
): TypeEnvironment {
  const aliases = new Map<string, TypeDeclaration | MergedInterface | null>();
  for (const [name, nodes] of declarations) {
    const declaration = typeDeclarations(nodes);
    if (declaration !== undefined) {
      aliases.set(name, declaration);
    }
  }

  const shadowed = new Set(
    program.body
      .filter((node) => node.type === "ImportDeclaration")
      .flatMap((node) => node.specifiers.map((specifier) => specifier.local.name)),
  );
  const localTypes = new Set(
    [...declarations]
      .filter((entry) =>
        entry[1].some((node) => ["ClassDeclaration", "TSEnumDeclaration"].includes(node.type)),
      )
      .map((entry) => entry[0]),
  );
  return { aliases, shadowed, localTypes };
}

function checkPublicTypes(
  context: Context,
  program: ESTree.Program,
  name: string,
  className: string,
) {
  const bindings = declarationsAndExports(program);
  const environment = { className, ...typeEnvironment(program, bindings.declarations) };
  const exports = bindings.exports.filter(
    (item) => item.name === name || (item.name === "default" && item.local === name),
  );
  for (const binding of uncheckedReexports(bindings, exports, name, environment)) {
    context.report({ node: binding.node, messageId: "entityType" });
  }

  const nodes = exportedDeclarations(bindings, exports);
  for (const node of new Set(nodes)) {
    const structural = node.type === "TSInterfaceDeclaration";
    const alias = node.type === "TSTypeAliasDeclaration";
    const scope = aliasEnvironment(node, environment, new Set());
    if (structural || (alias && !derivedEntityType(node.typeAnnotation, scope))) {
      context.report({ node, messageId: "entityType" });
    }
  }
}

function uncheckedReexports(
  bindings: DeclarationBindings,
  exports: ExportBinding[],
  name: string,
  environment: TypeEnvironment,
) {
  // 明示的な同名exportだけがstar経由の名前を隠す。ローカル定義やdefault名では隠れない。
  const named = bindings.exports.some((item) => item.name === name);
  const stars = named ? [] : bindings.exports.filter((item) => item.all);
  // 値importと同名のローカル型は通常のexportでは独立して検査する。
  // defaultの式exportは型宣言を検査しないため、import由来として扱う。
  const reexports = exports.filter(
    (item) =>
      item.source ||
      (!item.declaration &&
        item.local !== undefined &&
        environment.shadowed.has(item.local) &&
        (item.valueOnly || !environment.aliases.has(item.local))),
  );
  return [...reexports, ...stars];
}

// Entityの名前は所有ファイルに揃える。状態別の型を公開するFooEntity<T>も許容する。
export const entityClass = defineRule({
  meta: {
    messages: {
      entityClass:
        "Define the entity as an exported class named after its file. Keep errors outside entities.",
      entityType:
        "Derive every branch of the public entity type from its class, including interfaces and later exports.",
    },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    const match = filename.match(/\/domain\/[^/]+\/entities\/([^/]+)\.ts$/);
    if (!match || /\.(test|spec|typecheck|test-fixture)\.ts$/.test(filename)) {
      return {};
    }

    const name = match[1]
      .split("-")
      .map((part) => part[0].toUpperCase() + part.slice(1))
      .join("");
    return {
      Program(node) {
        const bindings = declarationsAndExports(node);
        const environment = typeEnvironment(node, bindings.declarations);
        const found = publishedClasses(node).find((item) => {
          const className = item.node.id?.name;
          if (
            item.node.type !== "ClassDeclaration" ||
            !className ||
            ![name, name + "Entity"].includes(className)
          ) {
            return false;
          }

          const superclass = item.node.superClass;
          return (
            !(superclass?.type === "Identifier" && superclass.name === "Error") &&
            preservesClassExport(item.expression, {
              ...environment,
              className,
              classNode: item.node,
              classAugmented: (bindings.declarations.get(className) ?? []).some(
                (declaration) => declaration.type === "TSModuleDeclaration",
              ),
            })
          );
        });
        const className = found?.node.id?.name;
        if (!found || !className) {
          context.report({ node, messageId: "entityClass" });
          return;
        }

        checkPublicTypes(context, node, name, className);
      },
    };
  },
});
