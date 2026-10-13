import { defineRule } from "vite-plus/lint/plugins";
import type { Context, ESTree, Visitor } from "vite-plus/lint/plugins";

function staticSource(node: ESTree.Node | null | undefined) {
  if (node?.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0].value.cooked;
  }

  return node && "value" in node ? node.value : undefined;
}

function forbiddenSource(source: unknown) {
  return (
    typeof source === "string" &&
    /^#api\/(?:infrastructure|application)\/[^/]+\/(?:queries|storage|stores|messaging)\//.test(
      source,
    )
  );
}

function dtoName(node: ESTree.TSType | null | undefined) {
  return node?.type === "TSTypeReference" && node.typeName?.type === "Identifier"
    ? node.typeName.name
    : null;
}

function isDto(node: ESTree.TSType | null | undefined, suffix: string, names: Set<string>) {
  if (node?.type !== "TSTypeReference") {
    return false;
  }

  const type = node.typeName;
  if (type.type === "TSQualifiedName") {
    return (
      type.left.type === "Identifier" &&
      type.right.name.endsWith(suffix) &&
      names.has(type.left.name)
    );
  }

  return type.type === "Identifier" && type.name.endsWith(suffix) && names.has(type.name);
}

function promiseResult(node: ESTree.TSType | null | undefined) {
  if (node?.type !== "TSTypeReference" || dtoName(node) !== "Promise") {
    return null;
  }

  return node.typeArguments?.params[0];
}

function checkDtoMethod(context: Context, node: ESTree.MethodDefinition, names: Set<string>) {
  if (
    node.kind === "constructor" ||
    node.accessibility === "private" ||
    node.accessibility === "protected"
  ) {
    return;
  }

  const method = node.value;
  const parameter = method.params[0];
  const input =
    parameter && "typeAnnotation" in parameter
      ? parameter.typeAnnotation?.typeAnnotation
      : undefined;
  const output = promiseResult(method.returnType?.typeAnnotation);
  const valid = [
    method.params.length === 1,
    isDto(input, "InputDto", names),
    isDto(output, "OutputDto", names),
  ].every(Boolean);
  if (!valid) {
    context.report({ node, messageId: "useCaseDto" });
  }
}

function collectDtoNames(program: ESTree.Program, names: Set<string>) {
  for (const node of program.body) {
    if (node.type !== "ImportDeclaration") {
      continue;
    }

    if (!/^#api\/application\/[^/]+\/dtos\//.test(node.source.value)) {
      continue;
    }

    for (const specifier of node.specifiers) {
      names.add(specifier.local.name);
    }
  }
}

export const repositoryResponsibilities = defineRule({
  meta: {
    messages: {
      storeEntity: "Entity persistence belongs in a domain Repository, not a Store.",
      adapterDependency:
        "Repository must not depend on Query, Storage, Store, or Messaging adapters or ports. Use schemas, mappers, or shared persistence helpers.",
      useCaseDto:
        "UseCase public operations must accept one named InputDto and return Promise<OutputDto>, with both DTOs imported from application dtos.",
      useCaseQuery:
        "UseCase must read restored Entities from Repository. Build output DTOs in application instead of injecting Query ports.",
      queryFile:
        "Query adapters must live in queries. Name Repository persistence helpers by the operation they perform.",
    },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    // 結合テストは複数アダプターを同時に検証する。本番実装だけの境界を守る。
    const repository = /\/infrastructure\/[^/]+\/repositories\//.test(filename);
    const store = /\/(?:application|infrastructure)\/[^/]+\/stores\//.test(filename);
    const useCase = /\/application\/[^/]+\/use-cases\//.test(filename);
    if ((!repository && !useCase && !store) || /\.test(?:[.-]|$)/.test(filename)) {
      return {};
    }

    const dtoNames = new Set<string>();
    const check = (node: ESTree.Node | null | undefined) => {
      if (!node) {
        return;
      }

      const source = staticSource(node);
      if (store && typeof source === "string" && /^#api\/domain\/[^/]+\/entities\//.test(source)) {
        context.report({ node, messageId: "storeEntity" });
      }

      if (repository && forbiddenSource(source)) {
        context.report({ node, messageId: "adapterDependency" });
      }

      if (
        useCase &&
        typeof source === "string" &&
        /^#api\/(?:application|infrastructure)\/[^/]+\/queries\//.test(source)
      ) {
        context.report({ node, messageId: "useCaseQuery" });
      }
    };
    return {
      Program(node) {
        if (useCase) {
          collectDtoNames(node, dtoNames);
        }

        if (repository && /(?:^|\/)[^/]*quer(?:y|ies)[^/]*\.ts$/.test(filename)) {
          context.report({ node, messageId: "queryFile" });
        }
      },
      MethodDefinition(node) {
        if (useCase) {
          checkDtoMethod(context, node, dtoNames);
        }
      },
      ...sourceVisitors(check),
    };
  },
});

function sourceVisitors(check: (node: ESTree.Node | null | undefined) => void): Visitor {
  return {
    ImportDeclaration(node) {
      check(node.source);
    },
    ExportNamedDeclaration(node) {
      check(node.source);
    },
    ExportAllDeclaration(node) {
      check(node.source);
    },
    ImportExpression(node) {
      check(node.source);
    },
    TSImportType(node) {
      check(node.source);
    },
    TSExternalModuleReference(node) {
      check(node.expression);
    },
    CallExpression(node) {
      if (node.callee.type === "Identifier" && node.callee.name === "require") {
        check(node.arguments[0]);
      }
    },
  };
}
