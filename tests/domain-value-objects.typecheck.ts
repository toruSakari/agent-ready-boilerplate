// コンパイル時だけの契約検査。本番コードからはインポートしない。
// コンパイル時だけの契約検査。本番コードからはインポートしない。
import type { AccessId } from "#api/domain/access/value-objects/access-id.ts";
// コンパイル時だけの契約検査。本番コードからはインポートしない。
import type { AccessName } from "#api/domain/access/value-objects/access-name.ts";
// コンパイル時だけの契約検査。本番コードからはインポートしない。
import type { EmailAddress } from "#api/domain/access/value-objects/email-address.ts";
import type { AccountCategory } from "#api/domain/access/value-objects/account-category.ts";
import type { AllowedIpRange } from "#api/domain/access/value-objects/allowed-ip-range.ts";
import type { Permission } from "#api/domain/access/value-objects/permission.ts";
import type { CustomerAccountId } from "#api/domain/access/value-objects/customer-account-id.ts";
import type { BusinessAccountId } from "#api/domain/access/value-objects/business-account-id.ts";
import type { OperatorAccountId } from "#api/domain/access/value-objects/operator-account-id.ts";
import type { AuthenticationSubjectId } from "#api/domain/access/value-objects/authentication-subject-id.ts";
import type { ReservationQuantity } from "#api/domain/inventory/value-objects/reservation-quantity.ts";
import type { StockQuantity } from "#api/domain/inventory/value-objects/stock-quantity.ts";
import type { OrderQuantity } from "#api/domain/order/value-objects/order-quantity.ts";
import type { CurrencyCode } from "#api/domain/payment/value-objects/currency-code.ts";
import type { PaymentAmount } from "#api/domain/payment/value-objects/payment-amount.ts";
import type { ProductName } from "#api/domain/shared/value-objects/product-name.ts";
import type { Sku } from "#api/domain/shared/value-objects/sku.ts";
import type { UnitPrice } from "#api/domain/shared/value-objects/unit-price.ts";

type Assert<T extends true> = T;

type Assignable<Source, Target> = [Source] extends [Target] ? true : false;

export type DomainValueObjectContracts = [
  Assert<Assignable<AccessId, string | number | boolean>>,
  Assert<Assignable<string, AccessId> extends false ? true : false>,
  Assert<Assignable<number, AccessId> extends false ? true : false>,
  Assert<Assignable<AccessName, string | number | boolean>>,
  Assert<Assignable<string, AccessName> extends false ? true : false>,
  Assert<Assignable<number, AccessName> extends false ? true : false>,
  Assert<Assignable<EmailAddress, string | number | boolean>>,
  Assert<Assignable<string, EmailAddress> extends false ? true : false>,
  Assert<Assignable<number, EmailAddress> extends false ? true : false>,
  Assert<Assignable<AccountCategory, string | number | boolean>>,
  Assert<Assignable<string, AccountCategory> extends false ? true : false>,
  Assert<Assignable<number, AccountCategory> extends false ? true : false>,
  Assert<Assignable<AllowedIpRange, string | number | boolean>>,
  Assert<Assignable<string, AllowedIpRange> extends false ? true : false>,
  Assert<Assignable<number, AllowedIpRange> extends false ? true : false>,
  Assert<Assignable<Permission, string | number | boolean>>,
  Assert<Assignable<string, Permission> extends false ? true : false>,
  Assert<Assignable<number, Permission> extends false ? true : false>,
  Assert<Assignable<CustomerAccountId, string | number | boolean>>,
  Assert<Assignable<string, CustomerAccountId> extends false ? true : false>,
  Assert<Assignable<number, CustomerAccountId> extends false ? true : false>,
  Assert<Assignable<BusinessAccountId, string | number | boolean>>,
  Assert<Assignable<string, BusinessAccountId> extends false ? true : false>,
  Assert<Assignable<number, BusinessAccountId> extends false ? true : false>,
  Assert<Assignable<OperatorAccountId, string | number | boolean>>,
  Assert<Assignable<string, OperatorAccountId> extends false ? true : false>,
  Assert<Assignable<number, OperatorAccountId> extends false ? true : false>,
  Assert<Assignable<AuthenticationSubjectId, string | number | boolean>>,
  Assert<Assignable<string, AuthenticationSubjectId> extends false ? true : false>,
  Assert<Assignable<number, AuthenticationSubjectId> extends false ? true : false>,
  Assert<Assignable<ReservationQuantity, string | number | boolean>>,
  Assert<Assignable<string, ReservationQuantity> extends false ? true : false>,
  Assert<Assignable<number, ReservationQuantity> extends false ? true : false>,
  Assert<Assignable<StockQuantity, string | number | boolean>>,
  Assert<Assignable<string, StockQuantity> extends false ? true : false>,
  Assert<Assignable<number, StockQuantity> extends false ? true : false>,
  Assert<Assignable<OrderQuantity, string | number | boolean>>,
  Assert<Assignable<string, OrderQuantity> extends false ? true : false>,
  Assert<Assignable<number, OrderQuantity> extends false ? true : false>,
  Assert<Assignable<CurrencyCode, string | number | boolean>>,
  Assert<Assignable<string, CurrencyCode> extends false ? true : false>,
  Assert<Assignable<number, CurrencyCode> extends false ? true : false>,
  Assert<Assignable<PaymentAmount, string | number | boolean>>,
  Assert<Assignable<string, PaymentAmount> extends false ? true : false>,
  Assert<Assignable<number, PaymentAmount> extends false ? true : false>,
  Assert<Assignable<ProductName, string | number | boolean>>,
  Assert<Assignable<string, ProductName> extends false ? true : false>,
  Assert<Assignable<number, ProductName> extends false ? true : false>,
  Assert<Assignable<Sku, string | number | boolean>>,
  Assert<Assignable<string, Sku> extends false ? true : false>,
  Assert<Assignable<number, Sku> extends false ? true : false>,
  Assert<Assignable<UnitPrice, string | number | boolean>>,
  Assert<Assignable<string, UnitPrice> extends false ? true : false>,
  Assert<Assignable<number, UnitPrice> extends false ? true : false>,
];
