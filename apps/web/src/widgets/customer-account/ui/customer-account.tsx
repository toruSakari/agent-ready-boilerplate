import { ServiceAccount } from "@dev-template/client/service-account";
import { DataErrorBoundary } from "@dev-template/client/error-boundary";
import { CustomerPlan } from "#web/features/change-plan/index.ts";
import { CustomerRegistrationPrompt } from "#web/widgets/customer-registration/index.ts";

export function CustomerAccount() {
  return (
    <ServiceAccount
      missingRegistrationContent={<CustomerRegistrationPrompt />}
      registeredContent={
        <DataErrorBoundary>
          <CustomerPlan />
        </DataErrorBoundary>
      }
    />
  );
}
