import { useRouterState, useNavigate } from "@tanstack/react-router";
import type { AnyRouter } from "@tanstack/react-router";
import type { z } from "zod";
import type { ListSearch } from "#client/widgets/list-filters/model/list-search.ts";

/** 条件の正本はURL。詳細から戻る操作・再読込みでも同じ条件を復元する。 */
export function useListSearch<T extends ListSearch>(schema: z.ZodType<T>) {
  // 共有hookは特定アプリのRegisterを参照せず、渡されたschemaで検索条件を検証する。
  const raw = useRouterState({ select: (state) => state.location.search });
  const navigate = useNavigate();
  const value = schema.parse(raw);
  const change = (next: ListSearch) => {
    const parsed = schema.parse(next);
    void navigate<AnyRouter, ".">({ to: ".", search: () => parsed });
  };
  return { value, change, key: JSON.stringify(value) };
}
