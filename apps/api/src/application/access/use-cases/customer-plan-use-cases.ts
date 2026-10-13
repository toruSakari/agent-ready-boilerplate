import { PlanAssignment } from "#api/domain/access/entities/plan-assignment.ts";
import { CustomerPlanPlansOutputDto } from "#api/application/access/dtos/customer-plan-plans-output-dto.ts";
import { CustomerPlanChangeOutputDto } from "#api/application/access/dtos/customer-plan-change-output-dto.ts";
import type { CustomerPlanPlansInputDto } from "#api/application/access/dtos/customer-plan-plans-input-dto.ts";
import type { CustomerPlanChangeInputDto } from "#api/application/access/dtos/customer-plan-change-input-dto.ts";
import type { AccessReadRepository } from "#api/domain/access/repositories/access-read-repository.ts";
import {
  accessState,
  deny,
  saveAccessChange,
  verifiedSubject,
} from "#api/application/access/shared/access-use-case-support.ts";
import type { AccessRepository } from "#api/domain/access/repositories/access-repository.ts";
import { AccessId } from "#api/domain/access/value-objects/access-id.ts";

/** 個人プランの所有者は認証済みの一般ユーザー本人。対象IDを入力として受け取らない。 */
export class CustomerPlanUseCases {
  constructor(
    private readonly repository: AccessRepository,
    private readonly reader: AccessReadRepository,
  ) {}

  async plans(inputDto: CustomerPlanPlansInputDto): Promise<CustomerPlanPlansOutputDto> {
    const { identity } = inputDto;
    if (identity.channel !== "customer") {
      deny();
    }

    const current = await this.reader.findPlan({ category: "customer", id: identity.userId });
    return CustomerPlanPlansOutputDto.parse({
      currentCode: current?.planCode === null || !current ? null : String(current.planCode),
      plans: this.reader
        .plans("customer")
        .map((plan) => ({ code: String(plan.code), name: String(plan.name) })),
    });
  }

  async change(inputDto: CustomerPlanChangeInputDto): Promise<CustomerPlanChangeOutputDto> {
    const { identity, input } = inputDto;
    if (identity.channel !== "customer") {
      deny();
    }

    const state = accessState(identity, identity.userId);
    const account = state.customerAccounts.find(
      (candidate) => candidate.id === identity.userId && candidate.status === "active",
    );
    if (!account || account.subjectId !== verifiedSubject(identity)) {
      deny();
    }

    const plan =
      input.planCode === null
        ? null
        : this.reader.plans("customer").find((candidate) => candidate.code === input.planCode);
    // 企業プラン・未知コード・クライアント申告の権限は選択候補にしない。
    if (input.planCode !== null && !plan) {
      deny();
    }

    await saveAccessChange(
      this.repository,
      identity,
      "customer",
      state,
      {
        planAssignments: [
          new PlanAssignment("customer", AccessId.create(account.id), plan?.code ?? null),
        ],
      },
      "plan.change",
      account.id,
    );
    return CustomerPlanChangeOutputDto.parse({ ok: true });
  }
}
