import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree, Visitor } from "vite-plus/lint/plugins";

function implementation(node: ESTree.Node | null): boolean {
  if (!node) {
    return false;
  }

  if (["ArrowFunctionExpression", "FunctionExpression", "ClassExpression"].includes(node.type)) {
    return true;
  }

  if (node.type === "CallExpression") {
    const callee = node.callee;
    const name = callee.type === "Identifier" ? callee.name : memberName(callee);
    if (name === "createContext") {
      return false;
    }

    return name === "forwardRef" || name === "memo" || node.arguments.some(implementation);
  }

  return false;
}

// 本番の実装だけを数え、再公開・Context・storyやテストの描画fixtureは含めない。
export const oneComponentPerFile = defineRule({
  meta: {
    messages: {
      multipleComponents:
        "Define each React component in its own file, including helper components.",
    },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    if (
      !/(?:^|\/)(apps|packages)\//.test(filename) ||
      !filename.endsWith(".tsx") ||
      /\.(test|spec|stories)\.tsx$/.test(filename)
    ) {
      return {};
    }

    let count = 0;
    const seen = new Set<ESTree.Node>();
    function register(node: ESTree.Node) {
      if (seen.has(node)) {
        return;
      }

      seen.add(node);
      if (++count > 1) {
        context.report({ node, messageId: "multipleComponents" });
      }
    }

    return componentVisitors(register);
  },
});

function componentVisitors(register: (node: ESTree.Node) => void): Visitor {
  return {
    FunctionDeclaration(node) {
      if (node.id && /^[A-Z]/.test(node.id.name)) {
        register(node);
      } else if (node.parent.type === "ExportDefaultDeclaration") {
        register(node);
      }
    },
    VariableDeclarator(node) {
      if (
        node.id.type === "Identifier" &&
        /^[A-Z]/.test(node.id.name) &&
        node.init &&
        implementation(node.init)
      ) {
        register(node.init);
      }
    },
    ClassDeclaration(node) {
      const base = node.superClass;
      const name = base?.type === "Identifier" ? base.name : memberName(base);
      if (name === "Component" || name === "PureComponent") {
        register(node);
      }
    },
    ExportDefaultDeclaration(node) {
      if (implementation(node.declaration)) {
        register(node.declaration);
      }
    },
  };
}

function memberName(node: ESTree.Node | null) {
  return node?.type === "MemberExpression" && "name" in node.property
    ? node.property.name
    : undefined;
}
