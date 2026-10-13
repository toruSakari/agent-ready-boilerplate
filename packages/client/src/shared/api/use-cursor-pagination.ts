"use client";
import { useState } from "react";
import type { RouterInputs } from "@dev-template/api-types";
import { LIST_PAGE_SIZE } from "#client/shared/api/pagination-policy";

type Cursor = NonNullable<RouterInputs["order"]["list"]["cursor"]>;

/** 戻る操作には各ページの開始カーソルを再利用し、次へ進む時は現在の末尾を記録する。 */
export function useCursorPagination() {
  const [state, setState] = useState<{ page: number; cursors: (Cursor | undefined)[] }>({
    page: 0,
    cursors: [undefined],
  });
  return {
    page: state.page,
    cursor: state.cursors[state.page],
    previousPage: () => setState((value) => ({ ...value, page: Math.max(0, value.page - 1) })),
    nextPage: (items: readonly Cursor[] | undefined) => {
      if (items?.length !== LIST_PAGE_SIZE) {
        return;
      }

      const last = items.at(-1)!;
      const cursor = { createdAt: last.createdAt, id: last.id };
      setState((value) => ({
        page: value.page + 1,
        cursors: [...value.cursors.slice(0, value.page + 1), cursor],
      }));
    },
  };
}
