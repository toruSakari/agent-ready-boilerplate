import { createValue } from "#api/domain/shared/create-value.ts";
import { InvalidValueObjectError } from "#api/domain/shared/errors/invalid-value-object-error.ts";
import { z } from "zod";

const IPV4_BITS = 32;
const IPV6_BITS = 128;
const IPV6_GROUP_BITS = 16;
const IPV6_GROUP_COUNT = 8;
const IPV4_OCTET_BITS = 8;

function address(value: string): { bits: number; value: bigint } | null {
  if (z.ipv4().safeParse(value).success) {
    return {
      bits: IPV4_BITS,
      value: value.split(".").reduce((n, v) => (n << BigInt(IPV4_OCTET_BITS)) | BigInt(v), 0n),
    };
  }

  if (!z.ipv6().safeParse(value).success) {
    return null;
  }

  // IPv4埋込みIPv6も通常のIPv6と同じビット列へ変換する。
  let text = value.toLowerCase();
  if (text.includes(".")) {
    const index = text.lastIndexOf(":");
    const ipv4 = address(text.slice(index + 1));
    if (!ipv4) {
      return null;
    }

    text =
      text.slice(0, index + 1) +
      (ipv4.value >> BigInt(IPV6_GROUP_BITS)).toString(16) +
      ":" +
      (ipv4.value & 0xffffn).toString(16);
  }

  const halves = text.split("::");
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves[1] ? halves[1].split(":") : [];
  const groups =
    halves.length === 1
      ? left
      : [
          ...left,
          ...Array<string>(IPV6_GROUP_COUNT - left.length - right.length).fill("0"),
          ...right,
        ];
  return {
    bits: IPV6_BITS,
    value: groups.reduce((n, v) => (n << BigInt(IPV6_GROUP_BITS)) | BigInt("0x" + v), 0n),
  };
}

function prefixLength(parts: string[], bits: number): number | null {
  if (parts.length === 1) {
    return bits;
  }

  if (parts.length !== 2 || !/^\d+$/.test(parts[1] ?? "")) {
    return null;
  }

  const prefix = Number(parts[1]);
  return Number.isInteger(prefix) && prefix >= 0 && prefix <= bits ? prefix : null;
}

function network(value: string) {
  const parts = value.split("/");
  const ip = address(parts[0] ?? "");
  if (!ip) {
    return null;
  }

  const prefix = prefixLength(parts, ip.bits);
  return prefix === null ? null : { ...ip, prefix };
}

// 許可範囲一件を文字列のまま保持し、設定全体の整合性は企業Entityが担う。
const schema = z
  .string()
  .trim()
  .refine((value) => network(value) !== null)
  .brand<"AllowedIpRange">();

export type AllowedIpRange = z.output<typeof schema>;

export const AllowedIpRange = Object.freeze({
  create(value: unknown): AllowedIpRange {
    return createValue(
      (input) => schema.safeParse(input),
      value,
      "許可IPはIPv4・IPv6またはCIDRで入力してください",
    );
  },
  contains(range: AllowedIpRange, clientIp: string | null): boolean {
    const client = clientIp === null ? null : address(clientIp);
    if (!client) {
      return false;
    }

    const allowed = network(range);
    if (!allowed) {
      throw new InvalidValueObjectError("許可IPの保存値が不正です");
    }

    const shift = BigInt(allowed.bits - allowed.prefix);
    return client.bits === allowed.bits && client.value >> shift === allowed.value >> shift;
  },
});
