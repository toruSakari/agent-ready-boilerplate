import { z } from "zod";
import { isNonEmptyString, isTimestamp } from "#api/domain/shared/validation.ts";

// 入力フォームと違い保存値は補正せず検証する。壊れた識別子や日時を暗黙に修復しない。
export const persistedText = z.string().refine(isNonEmptyString);
export const persistedTimestamp = z.string().refine(isTimestamp);
