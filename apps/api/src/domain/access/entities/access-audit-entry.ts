import { z } from "zod";

const schema = z.object({
  id: z.string().min(1),
  actorId: z.string().min(1),
  scope: z.string().min(1),
  action: z.string().min(1),
  targetId: z.string().min(1),
  occurredAt: z.string().min(1),
});

/** 保存された変更・閲覧記録。追記後の状態を変更しない。 */
export class AccessAuditEntry {
  declare private readonly identityBrand: void;

  private constructor(private readonly data: z.output<typeof schema>) {
    Object.freeze(data);
    Object.freeze(this);
  }

  static restore(this: void, value: unknown) {
    return new AccessAuditEntry(schema.parse(value));
  }

  get id() {
    return this.data.id;
  }

  toSnapshot() {
    return { ...this.data };
  }
}
