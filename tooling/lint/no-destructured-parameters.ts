import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";

type FunctionWithParameters =
  | ESTree.Function
  | ESTree.ArrowFunctionExpression
  | ESTree.TSMethodSignature
  | ESTree.TSFunctionType
  | ESTree.TSConstructorType
  | ESTree.TSCallSignatureDeclaration
  | ESTree.TSConstructSignatureDeclaration;

export const noDestructuredParameters = defineRule({
  meta: {
    messages: {
      destructuredParameter:
        "Receive arguments by name (for example, props) and access their properties in the function body.",
    },
  },
  create(context) {
    function check(node: FunctionWithParameters) {
      for (const parameter of node.params) {
        const argument = parameter.type === "TSParameterProperty" ? parameter.parameter : parameter;
        const value = argument.type === "RestElement" ? argument.argument : argument;
        const binding = value.type === "AssignmentPattern" ? value.left : value;
        if (binding.type === "ObjectPattern" || binding.type === "ArrayPattern") {
          context.report({ node: binding, messageId: "destructuredParameter" });
        }
      }
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
      TSDeclareFunction: check,
      TSMethodSignature: check,
      TSFunctionType: check,
      TSConstructorType: check,
      TSCallSignatureDeclaration: check,
      TSConstructSignatureDeclaration: check,
    };
  },
});
