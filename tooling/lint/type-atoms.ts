import type { ESTree } from "vite-plus/lint/plugins";
import type { MatchResult, PresentTarget, TypeNode } from "#tooling/lint/type-contracts.ts";

type Primitive = {
  kind: string;
  value?: string | number | bigint | boolean | RegExp | null;
  restricted?: boolean;
};

type AtomicPattern = "never" | "object" | "void" | "non-nullish";

const primitiveKinds = new Map([
  ["TSStringKeyword", "string"],
  ["TSNumberKeyword", "number"],
  ["TSBooleanKeyword", "boolean"],
  ["TSBigIntKeyword", "bigint"],
  ["TSSymbolKeyword", "symbol"],
  ["TSNullKeyword", "null"],
  ["TSUndefinedKeyword", "undefined"],
  ["TSVoidKeyword", "void"],
]);

export function primitive(node: TypeNode | null | undefined): Primitive | null {
  const kind = node && primitiveKinds.get(node.type);
  if (kind) {
    return { kind };
  }

  switch (node?.type) {
    case "TSTemplateLiteralType":
      // stringの部分集合だが、具体値の範囲や${never}による空集合までは確定しない。
      return { kind: "string", restricted: true };
    case "TSLiteralType":
      return literalPrimitive(node.literal);
    default:
      return null;
  }
}

function literalPrimitive(node: ESTree.Expression): Primitive | null {
  if (node.type === "TemplateLiteral") {
    return { kind: "string", value: node.quasis[0].value.cooked };
  }

  if (node.type === "UnaryExpression" && node.operator === "-") {
    const argument = literalPrimitive(node.argument);
    return argument && (typeof argument.value === "number" || typeof argument.value === "bigint")
      ? { kind: argument.kind, value: -argument.value }
      : null;
  }

  if (node.type === "Literal") {
    const value = node.value;
    return { kind: value === null ? "null" : typeof value, value };
  }

  return null;
}

export function matchPrimitive(
  source: TypeNode,
  pattern: TypeNode,
  inhabited = false,
): MatchResult {
  const actual = primitive(source);
  const expected = primitive(pattern);
  if (!actual || !expected) {
    return null;
  }

  if (actual.kind !== expected.kind) {
    return actual.restricted && !inhabited ? null : false;
  }

  return matchPrimitiveRange(actual, expected);
}

function matchPrimitiveRange(actual: Primitive, expected: Primitive): MatchResult {
  if (expected.restricted) {
    return null;
  }

  if (!("value" in expected)) {
    return true;
  }

  return actual.restricted ? null : "value" in actual && actual.value === expected.value;
}

export function entityReference(target: PresentTarget, name: string | undefined): boolean {
  return (
    target.type.type === "TSTypeReference" &&
    ("name" in target.type.typeName ? target.type.typeName.name : undefined) === name &&
    (name === undefined || !target.environment.shadowed.has(name))
  );
}

export function objectType(target: PresentTarget): boolean {
  return (
    ["TSObjectKeyword", "TSTypeLiteral", "TSInterfaceBody"].includes(target.type.type) ||
    disjointObjectShape(target.type) ||
    entityReference(target, target.environment.className)
  );
}

export function typeMembers(node: TypeNode): ESTree.TSSignature[] {
  if (node.type === "TSTypeLiteral") {
    return node.members;
  }

  return node.type === "TSInterfaceBody" ? node.body : [];
}

export function propertyName(member: ESTree.TSSignature): string | null {
  if (member.type !== "TSPropertySignature" || member.computed) {
    return null;
  }

  const key = member.key;
  if (key.type === "Identifier" || key.type === "PrivateIdentifier") {
    return key.name;
  }

  if (key.type !== "Literal") {
    return null;
  }

  return key.value instanceof RegExp ? key.value.toString() : String(key.value);
}

export function atomicPattern(target: PresentTarget): AtomicPattern | null {
  const keywords = new Map<string, AtomicPattern>([
    ["TSNeverKeyword", "never"],
    ["TSObjectKeyword", "object"],
    ["TSVoidKeyword", "void"],
  ]);
  const keyword = keywords.get(target.type.type);
  if (keyword) {
    return keyword;
  }

  const emptyObject =
    ["TSTypeLiteral", "TSInterfaceBody"].includes(target.type.type) &&
    typeMembers(target.type).length === 0 &&
    !target.incomplete;
  return emptyObject ? "non-nullish" : null;
}

function category(target: PresentTarget): string | null {
  if (objectType(target)) {
    return "object";
  }

  if (target.type.type === "TSUnknownKeyword") {
    return "unknown";
  }

  return primitive(target.type)?.kind ?? null;
}

// objectは非プリミティブ、{}は非nullish、voidはvoid/undefinedを受け入れる。
// anyや未解決の合成型は確定せず、既存の両分岐の検証へ戻す。
export function matchAtomic(source: PresentTarget, pattern: AtomicPattern): MatchResult {
  if (primitive(source.type)?.restricted && !source.inhabited && pattern !== "non-nullish") {
    return null;
  }

  const actual = category(source);
  if (actual === null) {
    return null;
  }

  switch (pattern) {
    case "object":
      return actual === "object";
    case "non-nullish":
      return !["null", "undefined", "void", "unknown"].includes(actual);
    case "void":
      return ["void", "undefined"].includes(actual);
    default:
      return false;
  }
}

// 配列・タプル・関数の形はプリミティブと交わらない。{length: number}などの構造型は別に扱う。
export function primitiveObjectMismatch(
  source: PresentTarget,
  pattern: PresentTarget,
): MatchResult {
  const actual = primitive(source.type);
  if (!actual || (actual.restricted && !source.inhabited)) {
    return null;
  }

  const nullish = ["null", "undefined", "void"].includes(actual.kind);
  return disjointObjectShape(pattern.type) || (nullish && objectType(pattern)) ? false : null;
}

function disjointObjectShape(node: TypeNode): boolean {
  if (node.type === "TSTypeOperator" && node.operator === "readonly") {
    return disjointObjectShape(node.typeAnnotation);
  }

  return ["TSArrayType", "TSTupleType", "TSFunctionType", "TSConstructorType"].includes(node.type);
}

// booleanはtrue/falseの有限union。一般のプリミティブやテンプレートの値域は展開しない。
export function unionMembers(node: TypeNode | null | undefined): ESTree.TSType[] | null {
  if (node?.type === "TSUnionType") {
    return node.types;
  }

  if (node?.type !== "TSBooleanKeyword") {
    return null;
  }

  return [true, false].map((value): ESTree.TSLiteralType => ({
    ...node,
    type: "TSLiteralType",
    literal: { ...node, type: "Literal", value, raw: String(value) },
  }));
}
