import plugin from "@/lint/no-relative-imports.ts";
import { RuleTester } from "vite-plus/lint/plugins-dev";
import { describe, it } from "vite-plus/test";

RuleTester.describe = (name, run) => describe(`引数の受け取り方: ${name}`, run);
RuleTester.it = (name, run) => it(`分割代入の範囲を検証する: ${name}`, run);
RuleTester.itOnly = (name, run) => it.only(`分割代入の範囲を検証する: ${name}`, run);
const tester = new RuleTester();

tester.run("project/no-destructured-parameters", plugin.rules["no-destructured-parameters"], {
  valid: [
    "function title(props) { return props.title; }",
    "const render = (props = {}) => props.title;",
    "function title(props) { const {title = 'default', ...rest} = props; return title; }",
    "const [value, setValue] = useState();",
    "const {data} = query();",
    "function add(left, right) { return left + right; }",
    "const pairs = entries.map(entry => entry[0]);",
  ],
  invalid: [
    ...[
      "declare function title({title}: {title: string}): string;",
      "type Title = ({title}: {title: string}) => string;",
      "interface Example { title({title}: {title: string}): string; }",
    ].map((code) => ({
      filename: "example.ts",
      code,
      errors: [{ messageId: "destructuredParameter" }],
    })),
    ...[
      "function title({title}) { return title; }",
      "const title = ({title}) => title;",
      "const title = ({title} = {}) => title;",
      "const title = function ({title: name}) { return name; };",
      "class Example { constructor({value}) {} }",
      "class Example { title({title}) { return title; } }",
      "const example = { title({title}) { return title; } };",
      "entries.map(([key, value]) => value);",
      "const title = ({nested: {title}}) => title;",
      "function example({...props}) { return props; }",
      "function example(...[value]) { return value; }",
      "const title = ([title] = []) => title;",
    ].map((code) => ({ code, errors: [{ messageId: "destructuredParameter" }] })),
  ],
});
