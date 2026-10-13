import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";

type Schemas = Map<string, ESTree.Expression | null>;

function zodChain(node: ESTree.Expression): boolean {
  if (node.type === "Identifier") {
    return node.name === "z";
  }

  if (node.type === "MemberExpression") {
    return zodChain(node.object);
  }

  if (node.type === "CallExpression") {
    return zodChain(node.callee);
  }

  return false;
}

function hasBrand(
  node: ESTree.Expression | null | undefined,
  schemas: Schemas,
  seen = new Set<string>(),
): boolean {
  if (!node) {
    return false;
  }

  if (node.type === "Identifier") {
    if (seen.has(node.name)) {
      return false;
    }

    seen.add(node.name);
    return hasBrand(schemas.get(node.name), schemas, seen);
  }

  if (node.type === "CallExpression" && node.callee.type === "MemberExpression") {
    return (
      ("name" in node.callee.property && node.callee.property.name === "brand") ||
      hasBrand(node.callee.object, schemas, seen)
    );
  }

  return false;
}

// 値オブジェクトの配置には単一値のZodブランドだけを置き、複合モデルの再混入を防ぐ。
export const singleValueObject = defineRule({
  meta: {
    messages: {
      classValue: "Value objects must use a single Zod branded value instead of a class.",
      brandedType: "Export value object types through z.output or z.infer of a branded schema.",
      compositeSchema: "Keep composite settings and collections outside value-objects.",
      missingBrand: "Define the value object with a Zod .brand() schema.",
    },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    if (
      !/\/domain\/[^/]+\/value-objects\/[^/]+\.ts$/.test(filename) ||
      /\.(test|typecheck)\.ts$/.test(filename)
    ) {
      return {};
    }

    const rejectClass = (node: ESTree.Class) => context.report({ node, messageId: "classValue" });
    const types: ESTree.TSTypeAliasDeclaration[] = [];
    const schemas: Schemas = new Map();
    let branded = false;

    return {
      VariableDeclarator(node) {
        if (node.id.type === "Identifier") {
          schemas.set(node.id.name, node.init);
        }
      },
      ClassDeclaration: rejectClass,
      ClassExpression: rejectClass,
      TSInterfaceDeclaration(node) {
        context.report({ node, messageId: "brandedType" });
      },
      TSTypeAliasDeclaration(node) {
        checkExportedType(context, node, types);
      },
      CallExpression(node) {
        if (checkZodCall(context, node)) {
          branded = true;
        }
      },
      "Program:exit"() {
        for (const node of types) {
          const type = node.typeAnnotation;
          const argument = "typeArguments" in type ? type.typeArguments?.params[0] : undefined;
          const schemaName =
            argument?.type === "TSTypeQuery" && argument.exprName.type === "Identifier"
              ? argument.exprName.name
              : undefined;
          if (schemaName ? !hasBrand(schemas.get(schemaName), schemas) : !branded) {
            context.report({ node, messageId: "missingBrand" });
          }
        }
      },
    };
  },
});

function checkExportedType(
  context: Context,
  node: ESTree.TSTypeAliasDeclaration,
  types: ESTree.TSTypeAliasDeclaration[],
) {
  if (node.parent.type !== "ExportNamedDeclaration") {
    return;
  }

  types.push(node);
  const type = node.typeAnnotation;
  const name = type.type === "TSTypeReference" ? type.typeName : undefined;
  if (
    type.type !== "TSTypeReference" ||
    name?.type !== "TSQualifiedName" ||
    name.left.type !== "Identifier" ||
    name.left.name !== "z" ||
    !["output", "infer"].includes(name.right.name)
  ) {
    context.report({ node, messageId: "brandedType" });
  }
}

function checkZodCall(context: Context, node: ESTree.CallExpression) {
  const callee = node.callee;
  if (callee.type !== "MemberExpression" || !zodChain(callee.object)) {
    return;
  }

  const name = "name" in callee.property ? callee.property.name : undefined;
  const branded = name === "brand";
  if (
    [
      "object",
      "array",
      "tuple",
      "record",
      "map",
      "set",
      "intersection",
      "discriminatedUnion",
    ].includes(typeof name === "string" ? name : "")
  ) {
    context.report({ node, messageId: "compositeSchema" });
  }

  return branded;
}
