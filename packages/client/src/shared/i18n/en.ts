import { accessEnglish } from "#client/shared/i18n/en-access.ts";
import { commerceEnglish } from "#client/shared/i18n/en-commerce.ts";
import { accountEnglish } from "#client/shared/i18n/en-account.ts";
import { commonEnglish } from "#client/shared/i18n/en-common.ts";

import { inventoryEnglish } from "#client/shared/i18n/en-inventory.ts";
import { listFilterEnglish } from "#client/shared/i18n/en-list-filters.ts";

export const english = {
  ...listFilterEnglish,
  ...inventoryEnglish,
  ...accessEnglish,
  ...commerceEnglish,
  ...accountEnglish,
  ...commonEnglish,
} as const;
