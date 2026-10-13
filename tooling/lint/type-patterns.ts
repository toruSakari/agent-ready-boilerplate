import type { ESTree } from "vite-plus/lint/plugins";
import type {
  InferredCandidates,
  MatchResult,
  ParameterBinding,
  PresentTarget,
  TypeEnvironment,
  TypeNode,
  TypeTarget,
} from "#tooling/lint/type-contracts.ts";
import { provablyEmptyType } from "#tooling/lint/empty-types.ts";
import { resolvedType, typeArguments } from "#tooling/lint/type-scopes.ts";
import { acceptsUnknown } from "#tooling/lint/unknown-types.ts";
import { templateState, sameTemplate } from "#tooling/lint/template-types.ts";
import {
  primitive,
  unionMembers,
  typeMembers,
  propertyName,
  matchPrimitive,
  entityReference,
  objectType,
  atomicPattern,
  matchAtomic,
  primitiveObjectMismatch,
} from "#tooling/lint/type-atoms.ts";

function combined(results: MatchResult[]): MatchResult {
  if (results.includes(false)) {
    return false;
  }

  return results.every((result) => result === true) ? true : null;
}

function memberTarget(member: ESTree.TSPropertySignature, target: TypeTarget): TypeTarget {
  return { ...target, type: member.typeAnnotation?.typeAnnotation };
}

function matchMembers(
  source: PresentTarget,
  pattern: PresentTarget,
  candidates: InferredCandidates,
): MatchResult {
  // 継承先もオブジェクトだが、未解決の継承メンバーから推論候補を作らない。
  if (source.incomplete || pattern.incomplete) {
    return null;
  }

  const results = typeMembers(pattern.type).map((member) => {
    const name = propertyName(member);
    if (member.type !== "TSPropertySignature" || name === null) {
      return null;
    }

    const actual = typeMembers(source.type).find(
      (item): item is ESTree.TSPropertySignature =>
        item.type === "TSPropertySignature" && propertyName(item) === name,
    );
    if (!actual) {
      return missingMember(source.type, member);
    }

    if (actual.optional && !member.optional) {
      return false;
    }

    return matchType(memberTarget(actual, source), memberTarget(member, pattern), candidates);
  });
  return combined(results);
}

function missingMember(source: TypeNode, member: ESTree.TSPropertySignature): MatchResult {
  // メソッド・索引・継承したメンバーを「存在しない」と断定して偽分岐を選ばない。
  if (
    source.type === "TSInterfaceBody" ||
    typeMembers(source).some((item) => propertyName(item) === null)
  ) {
    return null;
  }

  return member.optional === true;
}

function inferredType(
  source: TypeTarget,
  pattern: PresentTarget<ESTree.TSInferType>,
  candidates: InferredCandidates,
): MatchResult {
  const parameter = pattern.type.typeParameter;
  const name = parameter.name.name;
  const result = parameter.constraint
    ? matchType(source, { ...pattern, type: parameter.constraint }, candidates)
    : true;
  if (result === false) {
    return false;
  }

  candidates.set(name, [...(candidates.get(name) ?? []), source]);
  return result;
}

function matchUnion(
  source: PresentTarget,
  pattern: PresentTarget<ESTree.TSUnionType>,
  candidates: InferredCandidates,
): MatchResult {
  if (unionMembers(source.type)) {
    return matchSourceUnion(source, pattern, candidates);
  }

  const results = pattern.type.types.map((type) =>
    matchType(source, { ...pattern, type }, candidates),
  );
  if (results.includes(true)) {
    return true;
  }

  const fallback = results.every((result) => result === false) ? false : null;
  return source.type.type === "TSUnknownKeyword" ? (acceptsUnknown(pattern) ?? fallback) : fallback;
}

function matchStructure(
  source: PresentTarget,
  pattern: PresentTarget,
  candidates: InferredCandidates,
): MatchResult {
  const objects = ["TSTypeLiteral", "TSInterfaceBody"];
  if (objects.includes(source.type.type) && objects.includes(pattern.type.type)) {
    return matchMembers(source, pattern, candidates);
  }

  if (source.type.type === "TSArrayType" && pattern.type.type === "TSArrayType") {
    return matchType(
      { ...source, type: source.type.elementType },
      { ...pattern, type: pattern.type.elementType },
      candidates,
    );
  }

  if (source.type.type === "TSTupleType" && pattern.type.type === "TSTupleType") {
    return matchTuple(
      { ...source, type: source.type },
      { ...pattern, type: pattern.type },
      candidates,
    );
  }

  if (objectType(source) && primitive(pattern.type)) {
    return false;
  }

  return (
    primitiveObjectMismatch(source, pattern) ??
    matchPrimitive(source.type, pattern.type, source.inhabited)
  );
}

// ASTで確定できない代入関係は両分岐を残す。構造型がクラスに似ていても出自は補わない。
export function matchType(
  sourceTarget: TypeTarget,
  patternTarget: TypeTarget,
  candidates: InferredCandidates,
): MatchResult {
  const source = resolvedType(sourceTarget);
  const pattern = resolvedType(patternTarget);
  if (!source.type || !pattern.type) {
    return null;
  }

  if (pattern.type.type === "TSInferType") {
    return inferredType(sourceTarget, { ...pattern, type: pattern.type }, candidates);
  }

  if (source.exact === false || pattern.exact === false) {
    return null;
  }

  const actual = { ...source, type: source.type };
  const expected = { ...pattern, type: pattern.type };
  const state = templateState(actual);
  if (provablyEmptyType(actual) || sameTemplate(actual, expected, sameArgument)) {
    return true;
  }

  return matchConcreteType({ ...actual, inhabited: state === "inhabited" }, expected, candidates);
}

function matchConcreteType(
  source: PresentTarget,
  pattern: PresentTarget,
  candidates: InferredCandidates,
): MatchResult {
  if (["TSAnyKeyword", "TSUnknownKeyword"].includes(pattern.type.type)) {
    return true;
  }

  if (source.type.type === "TSNeverKeyword") {
    return true;
  }

  const atomic = atomicPattern(pattern);
  if (atomic) {
    return source.type.type === "TSUnionType"
      ? matchSourceUnion(source, pattern, candidates)
      : matchAtomic(source, atomic);
  }

  if (source.type.type === "TSUnionType") {
    return matchSourceUnion(source, pattern, candidates);
  }

  if (pattern.type.type === "TSUnionType") {
    return matchUnion(source, { ...pattern, type: pattern.type }, candidates);
  }

  if (source.type.type === "TSUnknownKeyword") {
    return acceptsUnknown(pattern);
  }

  if (sameEntity(source, pattern)) {
    return true;
  }

  return matchStructure(source, pattern, candidates);
}

function matchSourceUnion(
  source: PresentTarget,
  pattern: PresentTarget,
  candidates: InferredCandidates,
): MatchResult {
  const members = unionMembers(source.type);
  if (!members) {
    return null;
  }

  // anyを含み得るunionでは、既知の不一致より未確定を優先する。
  const results = members.map((type) => matchType({ ...source, type }, pattern, candidates));
  return results.includes(null) ? null : combined(results);
}

function sameEntity(source: PresentTarget, pattern: PresentTarget): boolean {
  const name = source.environment.className;
  return (
    entityReference(source, name) &&
    entityReference(pattern, name) &&
    sameArguments(source, pattern)
  );
}

function fixedElements(node: ESTree.TSTupleType): ESTree.TSType[] | null {
  const elements = node.elementTypes.map((element) => {
    if (element.type === "TSNamedTupleMember") {
      return element.optional ? null : element.elementType;
    }

    return element;
  });
  return elements.every(
    (element): element is ESTree.TSType =>
      element !== null && element.type !== "TSOptionalType" && element.type !== "TSRestType",
  )
    ? elements
    : null;
}

function matchTuple(
  source: PresentTarget<ESTree.TSTupleType>,
  pattern: PresentTarget<ESTree.TSTupleType>,
  candidates: InferredCandidates,
): MatchResult {
  const actual = fixedElements(source.type);
  const expected = fixedElements(pattern.type);
  // 可変長・省略可能なタプルの長さを固定とみなして分岐を切り捨てない。
  if (!actual || !expected) {
    return null;
  }

  if (actual.length !== expected.length) {
    return false;
  }

  return combined(
    actual.map((type, index) =>
      matchType({ ...source, type }, { ...pattern, type: expected[index] }, candidates),
    ),
  );
}

// 引数名だけを比べず、それぞれの宣言スコープで具体値まで解決する。異なる引数は不一致と断定しない。
function sameArguments(source: PresentTarget, pattern: PresentTarget): boolean {
  const actual = typeArguments(source.type);
  const expected = typeArguments(pattern.type);
  return (
    actual.length === expected.length &&
    actual.every((type, index) =>
      sameArgument({ ...source, type }, { ...pattern, type: expected[index] }),
    )
  );
}

function sameArgument(sourceTarget: TypeTarget, patternTarget: TypeTarget): boolean {
  const source = resolvedType(sourceTarget);
  const pattern = resolvedType(patternTarget);
  if (source.identity && source.identity === pattern.identity) {
    return true;
  }

  if (!source.type || !pattern.type || source.exact === false || pattern.exact === false) {
    return false;
  }

  return sameConcreteArgument({ ...source, type: source.type }, { ...pattern, type: pattern.type });
}

function sameConcreteArgument(source: PresentTarget, pattern: PresentTarget): boolean {
  if (sameTemplate(source, pattern, sameArgument)) {
    return true;
  }

  if (primitive(source.type)) {
    return (
      matchPrimitive(source.type, pattern.type) === true &&
      matchPrimitive(pattern.type, source.type) === true
    );
  }

  const keywords = ["TSAnyKeyword", "TSUnknownKeyword", "TSNeverKeyword", "TSObjectKeyword"];
  if (keywords.includes(source.type.type)) {
    return source.type.type === pattern.type.type;
  }

  return source.type === pattern.type && sameScope(source.environment, pattern.environment);
}

function sameScope(source: TypeEnvironment, pattern: TypeEnvironment): boolean {
  if (source.aliases !== pattern.aliases || source.shadowed !== pattern.shadowed) {
    return false;
  }

  const actual = source.parameters ?? new Map<string, ParameterBinding>();
  const expected = pattern.parameters ?? new Map<string, ParameterBinding>();
  return (
    actual.size === expected.size &&
    [...actual].every((entry) => {
      const other = expected.get(entry[0]);
      return other && (entry[1] === other || sameArgument(entry[1], other));
    })
  );
}
