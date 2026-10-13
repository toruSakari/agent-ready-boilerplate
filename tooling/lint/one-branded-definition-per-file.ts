import { declarationsAndExports, exportedDeclarations } from "#tooling/lint/declarations.ts";
import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";

function definitionRule(pattern: RegExp, kind: string) {
  return defineRule({
    meta: {
      messages: {
        multipleDefinitions:
          "Define each {{kind}} in its own file, keeping its schema, type, and factory together.",
      },
    },
    create(context) {
      const filename = context.filename.replaceAll("\\", "/");
      if (!pattern.test(filename) || /\.(test|spec|typecheck|test-fixture)\.ts$/.test(filename)) {
        return {};
      }

      const definitions = new Set<string>();
      function remember(name: string, node: ESTree.Node) {
        if (!definitions.has(name)) {
          definitions.add(name);
          if (definitions.size > 1) {
            context.report({ node, messageId: "multipleDefinitions", data: { kind } });
          }
        }
      }

      return {
        Program(node) {
          for (const declaration of exportedTypes(node)) {
            remember(declaration.id.name, declaration);
          }
        },
        CallExpression(node) {
          if (
            node.callee.type !== "MemberExpression" ||
            !("name" in node.callee.property) ||
            node.callee.property.name !== "brand"
          ) {
            return;
          }

          const argument = node.typeArguments?.params[0];
          if (
            argument?.type === "TSLiteralType" &&
            "value" in argument.literal &&
            typeof argument.literal.value === "string"
          ) {
            remember(argument.literal.value, node);
          }
        },
      };
    },
  });
}

// 公開型とブランド名を同じ一組として数える。import・再公開・未ブランドの共有スキーマは含めない。
function exportedTypes(program: ESTree.Program) {
  const bindings = declarationsAndExports(program);
  return [...new Set(exportedDeclarations(bindings))].filter(
    (node) => node.type === "TSTypeAliasDeclaration" || node.type === "TSInterfaceDeclaration",
  );
}

export const oneValueObjectPerFile = definitionRule(
  /\/domain\/[^/]+\/value-objects\/[^/]+\.ts$/,
  "value object",
);
export const oneDtoPerFile = definitionRule(/\/application\/[^/]+\/dtos\/[^/]+\.ts$/, "DTO");
