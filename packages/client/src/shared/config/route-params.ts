import { t as translate } from "#client/shared/i18n";
import { z } from "zod";

export const ROUTE_PARAM_LIMITS = Object.freeze({
  organizationIdMaxLength: 200,
  signInPathMaxLength: 200,
});
// Routerが復号済みの値を渡す。識別子をtrim・二重復号して別企業へ変換しない。
const pathValue = z
  .string()
  .min(1)
  .regex(/^\P{Cc}+$/u, { error: () => translate("パスに制御文字は使用できません") })
  .refine((value) => value === value.trim(), {
    error: () => translate("パスの前後に空白は使用できません"),
  });
export const organizationIdPathSchema = pathValue.max(ROUTE_PARAM_LIMITS.organizationIdMaxLength);
export const organizationPathParamsSchema = z.object({ organizationId: organizationIdPathSchema });
// Clerkが所有する複数段のログインパスは維持し、業務の企業IDとは別の契約にする。
export const signInPathParamsSchema = z.object({
  _splat: pathValue.max(ROUTE_PARAM_LIMITS.signInPathMaxLength),
});
export const organizationPathParams = {
  parse: (params: { organizationId: string }) => organizationPathParamsSchema.parse(params),
};
export const signInPathParams = {
  parse: (params: { _splat?: string }) => signInPathParamsSchema.parse(params),
};
