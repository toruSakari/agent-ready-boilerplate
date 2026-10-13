import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";

const aliasOwners = new Map([
  ["#api", "apps/api"],
  ["#api-tooling", "apps/api"],
  ["#web", "apps/web"],
  ["#business", "apps/business"],
  ["#admin", "apps/admin"],
  ["#client", "packages/client"],
  ["#config", "packages/config"],
]);
const frontendOwners = new Set(["apps/web", "apps/business", "apps/admin"]);

function crossesRepositoryBoundary(source: string, alias: string, owner: string) {
  if (source.startsWith("@/") || source.startsWith("/")) {
    return true;
  }

  const aliasOwner = aliasOwners.get(alias);
  if (aliasOwner && aliasOwner !== owner) {
    return true;
  }

  if (alias === "#app" && !frontendOwners.has(owner)) {
    return true;
  }

  const appPackage = source.match(/^@dev-template\/(api|web|business|admin)(?:\/|$)/)?.[1];
  return !!appPackage && owner !== `apps/${appPackage}`;
}

function staticImportSource(node: ESTree.Node) {
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }

  return "value" in node ? node.value : undefined;
}

function checkImportSource(
  context: Context,
  node: ESTree.Node | null | undefined,
  filename: string,
  owner: string | undefined,
) {
  if (!node) {
    return;
  }

  // 静的に特定できるimportだけを検査する。式付きの動的パスはこのルールでは判定しない。
  const source = staticImportSource(node);
  if (typeof source !== "string") {
    return;
  }

  if (source.startsWith(".")) {
    context.report({ node, messageId: "relativeImport" });
    return;
  }

  // ルート検証・オーケストレーションだけは全workspaceを参照できる。
  // アプリやパッケージに隣接したテスト・storyには、その例外を広げない。
  if (!owner) {
    return;
  }

  const alias = source.split("/")[0];
  if (crossesRepositoryBoundary(source, alias, owner)) {
    context.report({ node, messageId: "repositoryImport" });
  }

  if (
    alias === "#storybook" &&
    (source !== "#storybook/fixtures" || !filename.endsWith(".stories.tsx"))
  ) {
    context.report({ node, messageId: "storybookImport" });
  }
}

export const noRelativeImports = defineRule({
  meta: {
    messages: {
      repositoryImport:
        "Apps and packages must use their own package imports or a public package entry point.",
      relativeImport: "Use a workspace package or path alias instead of a relative import.",
      storybookImport: "Only colocated *.stories.tsx files may import #storybook/fixtures.",
    },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    const owner = filename.match(/(?:^|\/)((?:apps|packages)\/[^/]+)\//)?.[1];

    const checkSource = (node: ESTree.Node | null | undefined) =>
      checkImportSource(context, node, filename, owner);

    return {
      ImportDeclaration(node) {
        checkSource(node.source);
      },
      ExportNamedDeclaration(node) {
        checkSource(node.source);
      },
      ExportAllDeclaration(node) {
        checkSource(node.source);
      },
      ImportExpression(node) {
        checkSource(node.source);
      },
      TSImportType(node) {
        checkSource(node.source);
      },
      TSExternalModuleReference(node) {
        checkSource(node.expression);
      },
      CallExpression(node) {
        if (node.callee.type === "Identifier" && node.callee.name === "require") {
          checkSource(node.arguments[0]);
        }
      },
    };
  },
});
