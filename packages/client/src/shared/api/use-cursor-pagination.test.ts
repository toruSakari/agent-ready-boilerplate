import { act, renderHook } from "@testing-library/react";
import { expect, it } from "vite-plus/test";
import { useCursorPagination } from "#client/shared/api/use-cursor-pagination";
import { LIST_PAGE_SIZE } from "#client/shared/api/pagination-policy";

it("前のページへ戻り、再取得した末尾から新しい続きへ進む", () => {
  const { result } = renderHook(() => useCursorPagination());
  const items = Array.from({ length: LIST_PAGE_SIZE }, (_, id) => ({
    id: String(id),
    createdAt: "2026-10-10",
  }));
  act(() => result.current.nextPage(items));
  expect(result.current.cursor).toEqual(items.at(-1));
  expect(result.current.page).toBe(1);
  act(() => result.current.previousPage());
  expect(result.current.cursor).toBeUndefined();
  const updated = items.map((item) => ({ ...item, id: `updated-${item.id}` }));
  act(() => result.current.nextPage(updated));
  expect(result.current.cursor).toEqual(updated.at(-1));
  act(() => result.current.nextPage([]));
  expect(result.current.page).toBe(1);
});
