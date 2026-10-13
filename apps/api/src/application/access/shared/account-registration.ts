import { OperatorAccountRegistrationInputDto } from "#api/application/access/dtos/operator-account-registration-input-dto.ts";
import { BusinessAccountRegistrationInputDto } from "#api/application/access/dtos/business-account-registration-input-dto.ts";
import { CustomerAccountRegistrationInputDto } from "#api/application/access/dtos/customer-account-registration-input-dto.ts";
import { AccessRegistrationOutputDto } from "#api/application/access/dtos/access-registration-output-dto.ts";
import type { AccessRegistrationInputDto } from "#api/application/access/dtos/access-registration-input-dto.ts";
import { deny } from "#api/application/access/shared/access-use-case-support.ts";
import { BusinessAccountUseCases } from "#api/application/access/use-cases/business-account-use-cases.ts";
import { CustomerAccountUseCases } from "#api/application/access/use-cases/customer-account-use-cases.ts";
import { OperatorAccountUseCases } from "#api/application/access/use-cases/operator-account-use-cases.ts";

export async function accountRegistration(
  inputDto: AccessRegistrationInputDto,
  customerAccounts: CustomerAccountUseCases,
  businessAccounts: BusinessAccountUseCases,
  operatorAccounts: OperatorAccountUseCases,
): Promise<AccessRegistrationOutputDto> {
  const { identity } = inputDto;
  switch (identity.channel) {
    case "customer":
      return AccessRegistrationOutputDto.parse(
        await customerAccounts.registration(
          CustomerAccountRegistrationInputDto.parse({ identity: identity }),
        ),
      );
    case "business":
      return AccessRegistrationOutputDto.parse(
        await businessAccounts.registration(
          BusinessAccountRegistrationInputDto.parse({ identity: identity }),
        ),
      );
    case "admin":
      return AccessRegistrationOutputDto.parse(
        await operatorAccounts.registration(
          OperatorAccountRegistrationInputDto.parse({ identity: identity }),
        ),
      );
    default:
      return deny();
  }
}
