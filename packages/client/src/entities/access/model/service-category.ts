import { t as translate } from "#client/shared/i18n";
import type { ServiceCategory, AccessRole } from "#client/entities/access/model/types";

export const SERVICE_CATEGORY_LABELS = {
  get customer() {
    return translate("一般ユーザー");
  },
  get business() {
    return translate("事業者");
  },
  get operator() {
    return translate("運営");
  },
} satisfies Record<ServiceCategory, string>;

// 一般ユーザーは企業ロールを持たない。候補制御に加え、APIでも同じ境界を検証する。
export function roleSupportsService(_role: AccessRole, category: ServiceCategory) {
  return category !== "customer";
}
