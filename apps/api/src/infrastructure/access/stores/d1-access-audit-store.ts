import { drizzle } from "drizzle-orm/d1";
import { auditEntries } from "#api/infrastructure/access/schemas/schema.ts";
import type { AccessAuditStore } from "#api/application/access/stores/access-audit-store.ts";
import type { AuditEntry } from "#api/domain/access/repositories/access-repository.ts";

export class D1AccessAuditStore implements AccessAuditStore {
  private readonly db;

  constructor(binding: D1Database) {
    this.db = drizzle(binding);
  }

  async appendAudit(entry: AuditEntry) {
    await this.db.insert(auditEntries).values(entry);
  }
}
