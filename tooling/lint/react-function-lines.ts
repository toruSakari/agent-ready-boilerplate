import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";

function isComponent(node: ESTree.Function | ESTree.ArrowFunctionExpression) {
  if (node.id && /^[A-Z]/.test(node.id.name)) {
    return true;
  }

  let parent = node.parent;
  while (parent?.type === "CallExpression") {
    const name = calleeName(parent.callee);
    if (name !== "memo" && name !== "forwardRef") {
      return false;
    }

    parent = parent.parent;
  }

  return isComponentBinding(parent);
}

function isComponentBinding(parent: ESTree.Node | null) {
  return (
    (parent?.type === "VariableDeclarator" &&
      parent.id.type === "Identifier" &&
      /^[A-Z]/.test(parent.id.name)) ||
    parent?.type === "ExportDefaultDeclaration"
  );
}

function calleeName(node: ESTree.Expression) {
  if (node.type === "Identifier") {
    return node.name;
  }

  return node.type === "MemberExpression" && "name" in node.property
    ? node.property.name
    : undefined;
}

// TSXだけ標準の関数行数ルールを置き換え、hookやイベント処理は50行のまま検査する。
export const reactFunctionLines = defineRule({
  meta: {
    messages: {
      oversized: "{{kind}} has {{lines}} lines; review responsibilities above {{max}} lines.",
    },
  },
  create(context) {
    const source = context.sourceCode;
    const characters = source.text.split("");
    for (const comment of source.getAllComments()) {
      for (let index = comment.range[0]; index < comment.range[1]; index++) {
        if (characters[index] !== "\n") {
          characters[index] = " ";
        }
      }
    }

    const uncommented = characters.join("");
    function check(node: ESTree.Function | ESTree.ArrowFunctionExpression) {
      const component = isComponent(node);
      const max = component ? 300 : 50;
      const lines = uncommented
        .slice(node.range[0], node.range[1])
        .split("\n")
        .filter((line) => line.trim()).length;
      if (lines > max) {
        context.report({
          node,
          messageId: "oversized",
          data: { kind: component ? "React component" : "Function", lines, max },
        });
      }
    }
    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
});
