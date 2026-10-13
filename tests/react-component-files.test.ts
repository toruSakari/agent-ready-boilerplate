import plugin from "@/lint/no-relative-imports.ts";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

RuleTester.describe = (name, run) => describe(`コンポーネントのファイル分割: ${name}`, run);
RuleTester.it = (name, run) => it(`ファイル分割の規約を検証する: ${name}`, run);
RuleTester.itOnly = (name, run) => it.only(`ファイル分割の規約を検証する: ${name}`, run);

const filename = "packages/ui/src/example.tsx";
const tester = new RuleTester({ cwd: "/repository" });
const twoComponents = "function First() { return <div />; } function Second() { return null; }";

tester.run("project/one-component-per-file", plugin.rules["one-component-per-file"], {
  valid: [
    { filename, code: "export function Only() { return <div />; }" },
    { filename, code: "export default () => <div />;" },
    { filename, code: "export { First, Second } from 'external';" },
    {
      filename,
      code: "const Context = React.createContext(() => null); const Root = Primitive.Root; function Only() { return <Root />; }",
    },
    {
      filename,
      code: "function useValue() { return 1; } const Only = memo(forwardRef(() => <div />));",
    },
    ...["example.test.tsx", "example.spec.tsx", "example.stories.tsx"].map((name) => ({
      filename: `packages/ui/src/${name}`,
      code: twoComponents,
    })),
    { filename: "tests/example.tsx", code: twoComponents },
  ],
  invalid: [
    twoComponents,
    "const First = () => <div />; const Second = function () { return <div />; };",
    "const First = memo(() => <div />); const Second = React.forwardRef(() => <div />);",
    "const First = React.memo(Imported); const Second = forwardRef(render);",
    "function Outer() { function Inner() { return null; } return <Inner />; }",
    "function First() { return null; } export default () => <div />;",
    "function First() { return null; } export default function () { return <div />; }",
    "class First extends React.Component { render() { return null; } } class Second extends PureComponent { render() { return null; } }",
  ].map((code) => ({ filename, code, errors: [{ messageId: "multipleComponents" }] })),
});
