import { expect, it } from "vite-plus/test";
import { PlanAssignment } from "#api/domain/access/entities/plan-assignment.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";

it.each([AccessId.create("plan"), null])(
  "プラン割当を凍結したクラスで保持し、解除のnullを維持する: %s",
  (planCode) => {
    const assignment = new PlanAssignment("business", AccessId.create("organization"), planCode);
    expect(Object.isFrozen(assignment)).toBe(true);
    expect(Reflect.set(assignment, "planCode", "other")).toBe(false);
    expect(assignment.toSnapshot()).toStrictEqual({
      category: "business",
      id: "organization",
      planCode,
    });
  },
);
