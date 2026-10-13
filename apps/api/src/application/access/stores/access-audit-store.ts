import type { AuditEntry } from "#api/domain/access/repositories/access-repository.ts";

/** 個人情報閲覧の監査。変更に伴う監査はRepositoryの原子保存に残す。 */
export interface AccessAuditStore {
  appendAudit(entry: AuditEntry): Promise<void>;
}
