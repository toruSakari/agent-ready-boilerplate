import { primitive } from "#tooling/lint/type-atoms.ts";
import { resolvedType } from "#tooling/lint/type-scopes.ts";
import { templateState } from "#tooling/lint/template-types.ts";
import type { TypeTarget } from "#tooling/lint/type-contracts.ts";

type Primitive = NonNullable<ReturnType<typeof primitive>>;

// 具体的なnever・空テンプレート・交わらないプリミティブだけを確定する。
// 構造型のメンバーや未束縛の型パラメーターから空集合を推測しない。
export function provablyEmptyType(target: TypeTarget): boolean {
  const resolved = resolvedType(target);
  const node = resolved.type;
  if (!node || resolved.exact === false) {
    return false;
  }

  switch (node.type) {
    case "TSNeverKeyword":
      return true;
    case "TSTemplateLiteralType":
      return templateState(resolved) === "empty";
    case "TSUnionType":
      return node.types.every((type) => provablyEmptyType({ ...resolved, type }));
    case "TSIntersectionType": {
      const parts = node.types.map((type) => ({ ...resolved, type }));
      return emptyIntersection(parts);
    }
    default:
      return false;
  }
}

function emptyIntersection(parts: TypeTarget[]): boolean {
  if (parts.some(provablyEmptyType)) {
    return true;
  }

  // any・未解決型が混じる場合の簡約順序は扱わず、全成分を確認できる交差型に限定する。
  const atoms = parts.map(primitiveParts);
  return (
    atoms.every((part) => part !== null) && disjointPrimitives(atoms.flatMap((part) => part ?? []))
  );
}

function primitiveParts(target: TypeTarget): Primitive[] | null {
  const resolved = resolvedType(target);
  const node = resolved.type;
  if (!node || resolved.exact === false) {
    return null;
  }

  if (node.type === "TSIntersectionType") {
    // anyを含む内側の交差型は、先にanyへ簡約され得る。括弧・別名の境界を越えて成分を拾わない。
    const parts = node.types.map((type) => primitiveParts({ ...resolved, type }));
    return parts.some((part) => part === null) ? null : parts.flatMap((part) => part ?? []);
  }

  if (node.type === "TSUnknownKeyword") {
    return [];
  }

  const atom = primitive(node);
  return atom ? [atom] : null;
}

function disjointPrimitives(atoms: Primitive[]): boolean {
  return atoms.some((left, index) => atoms.slice(index + 1).some((right) => disjoint(left, right)));
}

function disjoint(left: Primitive, right: Primitive): boolean {
  if (left.kind !== right.kind) {
    // voidとundefinedには共通の値があるため、異なる名前だけでneverへ畳まない。
    return ![left.kind, right.kind].every((kind) => kind === "void" || kind === "undefined");
  }

  return "value" in left && "value" in right && left.value !== right.value;
}
