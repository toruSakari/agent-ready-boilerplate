import { rollup } from "rollup";
import { dts } from "rollup-plugin-dts";
// 型チェック用TypeScriptとは別に、宣言のAST変換に必要な互換Compiler APIを使う。
import ts from "@typescript/typescript6";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { parseArgs } from "node:util";
import { join } from "node:path";

const { values } = parseArgs({
  options: { out: { type: "string", default: "dist/contracts/index.d.ts" } },
});
const external = (id) => !id.startsWith(".") && !id.startsWith("/") && !id.startsWith("#api/");
const bundle = await rollup({
  input: "src/contract.ts",
  plugins: [dts({ tsconfig: "tsconfig.json" })],
  external,
});
const directory = mkdtempSync(join(tmpdir(), "api-contract-"));
try {
  const { output } = await bundle.generate({ format: "es" });
  const source = ts.createSourceFile("contract.d.ts", output[0].code, ts.ScriptTarget.Latest, true);
  // クライアントが必要とする入出力・エラー型は残し、サーバーDIのcontext型だけを隠す。
  const transformed = ts.transform(source, [
    (context) => {
      const visit = (node) => {
        if (
          ts.isTypeLiteralNode(node) &&
          ["ctx", "meta", "errorShape", "transformer"].every((name) =>
            node.members.some((member) => member.name?.getText(source) === name),
          )
        ) {
          return ts.factory.updateTypeLiteralNode(
            node,
            node.members.map((member) => {
              if (ts.isPropertySignature(member) && member.name.getText(source) === "ctx") {
                return ts.factory.updatePropertySignature(
                  member,
                  member.modifiers,
                  member.name,
                  member.questionToken,
                  ts.factory.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword),
                );
              }

              return ts.visitEachChild(member, visit, context);
            }),
          );
        }

        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit);
    },
  ]);
  const file = join(directory, "contract.d.ts");
  writeFileSync(file, ts.createPrinter().printFile(transformed.transformed[0]));
  transformed.dispose();
  // contextをunknownへ置換した後で再バンドルし、不要になったサーバー内部型も公開物から除く。
  const publicBundle = await rollup({ input: file, plugins: [dts()], external });
  try {
    await publicBundle.write({ file: values.out, format: "es" });
  } finally {
    await publicBundle.close();
  }
} finally {
  await bundle.close();
  rmSync(directory, { recursive: true, force: true });
}
