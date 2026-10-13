import type { ESTree } from "vite-plus/lint/plugins";
import type {
  TypeNode,
  TypeEnvironment,
  TypeTarget,
  SeenTypes,
} from "#tooling/lint/type-contracts.ts";
import { typeMembers } from "#tooling/lint/type-atoms.ts";
import { constructorTarget, heritageTarget } from "#tooling/lint/class-type-references.ts";

interface StaticState {
  keys: Set<string>;
  added: boolean;
  unsafe: boolean;
  classRecorded: boolean;
}

export function compatibleStaticMembers(
  types: ESTree.TSType[],
  environment: TypeEnvironment,
  seen: SeenTypes,
): boolean {
  const state: StaticState = { keys: new Set(), added: false, unsafe: false, classRecorded: false };
  types.forEach((type) => {
    collectStaticMembers({ type, environment, seen }, state);
  });
  // 静的メンバーの衝突は交差型全体をneverにする場合がある。互換性を確定できない重複は許可しない。
  return !state.added || !state.unsafe;
}

function collectStaticMembers(target: TypeTarget | null, state: StaticState): void {
  if (!target) {
    state.unsafe = true;
    return;
  }

  if (target.targets) {
    target.targets.forEach((part) => collectStaticMembers(part, state));
    return;
  }

  const { type } = target;
  if (!type) {
    state.unsafe = true;
    return;
  }

  collectTypeStaticMembers({ ...target, type }, state);
}

function collectTypeStaticMembers(
  target: TypeTarget & { type: TypeNode },
  state: StaticState,
): void {
  const { type, environment, seen } = target;
  if (type.type === "TSTypeReference") {
    collectStaticMembers(constructorTarget(type, environment, seen), state);
    return;
  }

  if (type.type === "TSParenthesizedType") {
    collectStaticMembers({ ...target, type: type.typeAnnotation }, state);
    return;
  }

  if (type.type === "TSIntersectionType" || type.type === "TSUnionType") {
    type.types.forEach((node) => collectStaticMembers({ ...target, type: node }, state));
    return;
  }

  if (type.type === "TSTypeQuery") {
    recordClassStaticKeys(environment, state);
    return;
  }

  if (["TSTypeLiteral", "TSInterfaceBody"].includes(type.type)) {
    collectShapeStaticMembers({ ...target, type }, state);
  }
}

function collectShapeStaticMembers(
  target: TypeTarget & { type: TypeNode },
  state: StaticState,
): void {
  // 構築シグネチャを持つ型の静的メンバーも、他の構成型との衝突検査に含める。
  const members = typeMembers(target.type).filter(hasStaticKey);
  state.added ||= members.length > 0;
  recordStaticKeys(members, state);
  const bases =
    target.declaration?.type === "TSInterfaceDeclaration" ? target.declaration.extends : [];
  for (const base of bases) {
    collectStaticMembers(heritageTarget(base, target.environment, target.seen), state);
  }
}

function recordClassStaticKeys(environment: TypeEnvironment, state: StaticState): void {
  // 同じクラスへのtypeof参照は一つの静的契約であり、繰り返しても衝突を増やさない。
  if (state.classRecorded) {
    return;
  }

  state.classRecorded = true;
  const declaration = environment.classNode;
  state.unsafe ||=
    !declaration || Boolean(declaration.superClass) || environment.classAugmented === true;
  for (const key of ["prototype", "name", "length"]) {
    recordStaticKey(key, false, state);
  }

  recordStaticKeys(
    (declaration?.body.body ?? []).filter((member) => "static" in member && member.static),
    state,
  );
}

function hasStaticKey(member: ESTree.TSSignature): boolean {
  return !["TSConstructSignatureDeclaration", "TSCallSignatureDeclaration"].includes(member.type);
}

function recordStaticKeys(
  members: (ESTree.TSSignature | ESTree.ClassElement)[],
  state: StaticState,
): void {
  for (const member of members) {
    const key = "key" in member ? member.key : null;
    let name: unknown;
    if (key && "name" in key) {
      name = key.name;
    } else if (key && "value" in key) {
      name = key.value;
    }

    recordStaticKey(name, "computed" in member && member.computed, state);
  }
}

function recordStaticKey(key: unknown, computed: boolean, state: StaticState): void {
  if (computed || !["string", "number"].includes(typeof key) || state.keys.has(String(key))) {
    state.unsafe = true;
  }

  state.keys.add(String(key));
}
