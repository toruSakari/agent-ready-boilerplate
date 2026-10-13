import { t } from "#api/presentation/shared/trpc-core.ts";
import { accountProcedures } from "#api/presentation/access/account-procedures.ts";
import { membershipProcedures } from "#api/presentation/access/membership-procedures.ts";
import { organizationProcedures } from "#api/presentation/access/organization-procedures.ts";

export const accessRouter = t.mergeRouters(
  accountProcedures,
  membershipProcedures,
  organizationProcedures,
);
