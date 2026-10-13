import { z } from "zod";
import { t } from "@dev-template/client/i18n";

export const stockInputSchema = z
  .number({ error: () => t("在庫は0以上の整数を入力してください") })
  .int({ error: () => t("在庫は0以上の整数を入力してください") })
  .min(0, { error: () => t("在庫は0以上の整数を入力してください") })
  .max(Number.MAX_SAFE_INTEGER, { error: () => t("在庫は0以上の整数を入力してください") });
