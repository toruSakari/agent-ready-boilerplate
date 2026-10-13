import { accessIdSchema } from "#api/domain/access/value-objects/access-id.ts";

// 移行済みIDも受け入れるためUUIDには限定せず、サービス接頭辞と空でない接尾辞を検証する。
export function serviceAccountIdSchema(prefix: string) {
  return accessIdSchema
    .startsWith(prefix)
    .refine((value) => value.slice(prefix.length).trim().length > 0);
}
