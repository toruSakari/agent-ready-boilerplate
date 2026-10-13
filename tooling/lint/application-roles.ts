import { defineRule } from "vite-plus/lint/plugins";
import type { ESTree } from "vite-plus/lint/plugins";
import { publishedClasses, classNames } from "#tooling/lint/declarations.ts";

const classRoles: [RegExp, string][] = [
  [/UseCases?$/, "use-cases"],
  [/Provider$/, "providers"],
  [/Policy$/, "policies"],
];

function useCaseImplementation(program: ESTree.Program, filename: string) {
  const name = filename
    .split("/")
    .at(-1)!
    .replace(/\.ts$/, "")
    .split("-")
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join("");
  return publishedClasses(program).some(
    (item) => item.name === name && /UseCases?$/.test(item.name),
  );
}

export const applicationRoles = defineRule({
  meta: {
    messages: {
      serviceName:
        "Name application classes by their role: UseCase, Provider, or Policy, instead of Service.",
      classPlacement: "Place {{name}} in the owning application's {{directory}} directory.",
      filePlacement:
        "Place application files in a role directory; reserve use-cases for an exported UseCase class matching the filename.",
    },
  },
  create(context) {
    const filename = context.filename.replaceAll("\\", "/");
    const path = filename.match(/\/application\/([^/]+)\/(.+)\.ts$/);
    if (!path || /\.(test|spec|typecheck)(?:[.-]|$)/.test(filename)) {
      return {};
    }

    const role = path[2].split("/")[0];
    function checkClass(node: ESTree.Class) {
      for (const name of classNames(node)) {
        if (name.endsWith("Service")) {
          context.report({ node, messageId: "serviceName" });
          continue;
        }

        const directory = classRoles.find((entry) => entry[0].test(name))?.[1];
        if (directory && directory !== role) {
          context.report({ node, messageId: "classPlacement", data: { name, directory } });
        }
      }
    }

    return {
      Program(node) {
        const flat = path[1] !== "shared" && !path[2].includes("/");
        const helper = role === "use-cases" && !useCaseImplementation(node, filename);
        if (flat || helper) {
          context.report({ node, messageId: "filePlacement" });
        }
      },
      ClassDeclaration: checkClass,
      ClassExpression: checkClass,
    };
  },
});
