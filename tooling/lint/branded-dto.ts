import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree } from "vite-plus/lint/plugins";

type Schemas = Map<string, ESTree.Expression | null>;

function brandName(node: ESTree.CallExpression) {
  const argument = node.typeArguments?.params[0];
  return argument?.type === "TSLiteralType" && "value" in argument.literal
    ? argument.literal.value
    : null;
}

function ownBrand(
  node: ESTree.Node | null | undefined,
  name: string,
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
    return ownBrand(schemas.get(node.name), name, schemas, seen);
  }

  if (node.type === "ArrowFunctionExpression") {
    return ownBrand(node.body, name, schemas, seen);
  }

  if (node.type !== "CallExpression" || node.callee.type !== "MemberExpression") {
    return false;
  }

  if ("name" in node.callee.property && node.callee.property.name === "brand") {
    return brandName(node) === name;
  }

  return ownBrand(node.callee.object, name, schemas, seen);
}

function inferred(node: ESTree.TSType) {
  return (
    node?.type === "TSTypeReference" &&
    node.typeName?.type === "TSQualifiedName" &&
    node.typeName.left.type === "Identifier" &&
    node.typeName.left.name === "z" &&
    ["infer", "output"].includes(node.typeName.right.name)
  );
}

function remember(node: ESTree.Node | null, schemas: Schemas) {
  if (node?.type !== "VariableDeclaration") {
    return;
  }

  for (const declaration of node.declarations) {
    if (declaration.id.type === "Identifier") {
      schemas.set(declaration.id.name, declaration.init);
    }
  }
}

function checkType(context: Context, node: ESTree.TSTypeAliasDeclaration, schemas: Schemas) {
  if (
    !inferred(node.typeAnnotation) ||
    !ownBrand(schemas.get(node.id.name), node.id.name, schemas)
  ) {
    context.report({ node, messageId: "brandedDto" });
  }
}

export const brandedDto = defineRule({
  meta: {
    messages: {
      brandedDto:
        "Define DTOs through z.infer or z.output of a Zod schema branded with the DTO name. Reuse schemas instead of copying type fields.",
      brandCast:
        "Create branded DTOs with schema validation. Do not assert a value into a DTO type.",
    },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    if (/\.(test|typecheck)\.ts$/.test(filename)) {
      return {};
    }

    const dtoFile = /\/application\/[^/]+\/dtos\/[^/]+\.ts$/.test(filename);
    const schemas: Schemas = new Map();
    const rejectClass = (node: ESTree.Class) => {
      if (dtoFile) {
        context.report({ node, messageId: "brandedDto" });
      }
    };
    return {
      ClassDeclaration: rejectClass,
      ClassExpression: rejectClass,
      Program(node) {
        if (!dtoFile) {
          return;
        }

        for (const statement of node.body) {
          remember(
            statement.type === "ExportNamedDeclaration" ? statement.declaration : statement,
            schemas,
          );
        }
      },
      ExportNamedDeclaration(node) {
        if (!dtoFile || !node.declaration) {
          return;
        }

        if (node.declaration.type === "TSTypeAliasDeclaration") {
          checkType(context, node.declaration, schemas);
        }

        if (node.declaration.type === "TSInterfaceDeclaration") {
          context.report({ node, messageId: "brandedDto" });
        }
      },
      TSAsExpression(node) {
        const type = node.typeAnnotation;
        if (type?.type === "TSTypeReference" && /Dto$/.test(typeName(type.typeName))) {
          context.report({ node, messageId: "brandCast" });
        }
      },
    };
  },
});

function typeName(node: ESTree.TSTypeName): string {
  if (node.type === "Identifier") {
    return node.name;
  }

  return node.type === "TSQualifiedName" ? node.right.name : "";
}
