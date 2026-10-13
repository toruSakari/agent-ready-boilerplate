import { createFileRoute, notFound } from "@tanstack/react-router";

// 個人プランは一般ユーザー本人の会員情報で扱う。旧運営ページは提供しない。
export const Route = createFileRoute("/(admin)/_authenticated/_qualified/plans/")({
  beforeLoad: () => {
    throw notFound();
  },
});
