import { t as translate } from "@dev-template/client/i18n";
import { z } from "zod";

export const BUSINESS_IP_FORM_MAX_ENTRIES = 50;
const IPV4_BITS = 32;
const IPV6_BITS = 128;
export const entries = (text: string) =>
  text
    .split(/\r?\n/)
    .map((v) => v.trim())
    .filter(Boolean);

function addressBits(ip: string) {
  if (z.ipv4().safeParse(ip).success) {
    return IPV4_BITS;
  }

  if (z.ipv6().safeParse(ip).success) {
    return IPV6_BITS;
  }

  return 0;
}

function validIpEntry(entry: string) {
  const [ip = "", prefix, ...extra] = entry.split("/");
  const bits = addressBits(ip);
  if (!bits || extra.length) {
    return false;
  }

  return prefix === undefined || (/^\d+$/.test(prefix) && Number(prefix) <= bits);
}

export const businessIpFormSchema = z
  .object({ enabled: z.boolean(), allowedIps: z.string() })
  .superRefine((value, ctx) => {
    const ips = entries(value.allowedIps);
    if (ips.length > BUSINESS_IP_FORM_MAX_ENTRIES || (value.enabled && !ips.length)) {
      ctx.addIssue({
        code: "custom",
        path: ["allowedIps"],
        message: translate("有効にする場合、許可IPを1〜{{max}}件入力してください", {
          max: BUSINESS_IP_FORM_MAX_ENTRIES,
        }),
      });
    }

    for (const entry of ips) {
      if (!validIpEntry(entry)) {
        ctx.addIssue({
          code: "custom",
          path: ["allowedIps"],
          message: translate("IPv4・IPv6またはCIDRで入力してください"),
        });
      }
    }
  });
