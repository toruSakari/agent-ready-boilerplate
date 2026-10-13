import { t } from "#client/shared/i18n";
import {
  CATALOG_INPUT_LIMITS,
  ORDER_INPUT_LIMITS,
  INTEGER_INPUT_STEP,
} from "#client/shared/config/input-limits";

export const LINE_FIELD_NAMES = ["sku", "name", "quantity", "unitPrice"] as const;

export type LineFieldName = (typeof LINE_FIELD_NAMES)[number];

export function lineFieldConfig(name: LineFieldName) {
  const config = {
    sku: { label: "SKU", maxLength: CATALOG_INPUT_LIMITS.skuMaxLength },
    name: { label: t("商品名"), maxLength: CATALOG_INPUT_LIMITS.nameMaxLength },
    quantity: {
      label: t("数量"),
      min: ORDER_INPUT_LIMITS.quantityMin,
      max: ORDER_INPUT_LIMITS.quantityMax,
    },
    unitPrice: {
      label: t("単価"),
      min: CATALOG_INPUT_LIMITS.unitPriceMin,
      max: CATALOG_INPUT_LIMITS.unitPriceMax,
    },
  };
  return {
    ...config[name],
    numeric: name === "quantity" || name === "unitPrice",
    step: INTEGER_INPUT_STEP,
  };
}
