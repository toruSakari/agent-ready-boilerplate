import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";

const declarations = new Set([
  "FunctionDeclaration",
  "ClassDeclaration",
  "TSInterfaceDeclaration",
  "TSTypeAliasDeclaration",
]);
const blocks = new Set([
  "IfStatement",
  "ForStatement",
  "ForInStatement",
  "ForOfStatement",
  "WhileStatement",
  "DoWhileStatement",
  "SwitchStatement",
  "TryStatement",
]);

function declaration(node: ESTree.Node) {
  return "declaration" in node ? (node.declaration ?? node) : node;
}

function moduleReference(node: ESTree.Node) {
  return node.type === "ImportDeclaration" || ("source" in node && Boolean(node.source));
}

function schemaTypePair(previous: ESTree.Node, next: ESTree.Node) {
  const before = declaration(previous);
  const after = declaration(next);
  return (
    before.type === "VariableDeclaration" &&
    after.type === "TSTypeAliasDeclaration" &&
    before.declarations.some(
      (item) => item.id.type === "Identifier" && item.id.name === after.id.name,
    )
  );
}

function needsSpace(previous: ESTree.Node, next: ESTree.Node, kind: "class" | "program" | "block") {
  if (kind === "class") {
    return previous.type === "MethodDefinition" || next.type === "MethodDefinition";
  }

  if (blocks.has(previous.type)) {
    return true;
  }

  if (kind !== "program") {
    return false;
  }

  if (moduleReference(previous)) {
    return !moduleReference(next);
  }

  if (schemaTypePair(previous, next)) {
    return false;
  }

  return declarations.has(declaration(previous).type) || declarations.has(declaration(next).type);
}

function separate(context: Context, previous: ESTree.Node, next: ESTree.Node) {
  const source = context.sourceCode;
  // 次の宣言の説明コメントは、その宣言と一緒に残す。前の文の行末コメントは動かさない。
  const comment = source
    .getCommentsBefore(next)
    .find((item) => item.loc.start.line > previous.loc.end.line);
  const start = comment?.range[0] ?? next.range[0];
  const between = source.text.slice(previous.range[1], start);
  if (/\r?\n[\t ]*\r?\n/.test(between)) {
    return;
  }

  context.report({
    node: next,
    messageId: "blankLine",
    fix(fixer) {
      const lineStart = source.text.lastIndexOf("\n", start - 1) + 1;
      const indent = source.text.slice(lineStart, start);
      const newline = source.text.includes("\r\n") ? "\r\n" : "\n";
      const ownLine = /^[\t ]*$/.test(indent);
      const position = ownLine ? lineStart : start;
      return fixer.insertTextBeforeRange(
        [position, position],
        ownLine ? newline : newline + newline,
      );
    },
  });
}

export const readableSpacing = defineRule({
  meta: {
    type: "layout",
    fixable: "whitespace",
    messages: {
      blankLine:
        "Separate declarations, methods, and completed control blocks with one blank line.",
    },
  },
  create(context) {
    function check(body: ESTree.Node[], kind: "class" | "program" | "block") {
      for (let index = 1; index < body.length; index++) {
        if (needsSpace(body[index - 1], body[index], kind)) {
          separate(context, body[index - 1], body[index]);
        }
      }
    }

    return {
      Program: (node) => check(node.body, "program"),
      ClassBody: (node) => check(node.body, "class"),
      BlockStatement: (node) => check(node.body, "block"),
      SwitchCase: (node) => check(node.consequent, "block"),
    };
  },
});
