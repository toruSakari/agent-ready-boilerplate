import { test, expect } from "@/e2e/fixtures";
import { E2E_SERVER_ORIGINS } from "@/e2e/server-policy";

// 未発行tokenを使い、所属を作らずに無効招待の再試行・破棄・履歴操作を確認する。
const firstToken = "a".repeat(64);
const secondToken = "b".repeat(64);
for (const app of ["business", "admin"] as const) {
  test(`${app}: 招待入口はURLを消去し、再読み込み・ログイン画面の往復・再試行を保つ`, async (props) => {
    const origin = E2E_SERVER_ORIGINS[app];
    await props.page.goto(`${origin}/invitations/accept#${firstToken}`);
    await expect(
      props.page.getByRole("heading", { name: "企業・運営への招待を承諾" }),
    ).toBeVisible();
    await expect(props.page).toHaveURL(`${origin}/invitations/accept`);
    await props.page.reload();
    await expect(props.page.getByLabel("表示名", { exact: true })).toBeVisible();
    // デモ認証はすぐ戻る。Clerkへ遷移する際の引き渡しはコンポーネントの契約テストで確認する。
    await props.page.goto(`${origin}/sign-in?returnTo=%2Finvitations%2Faccept`);
    await expect(props.page).toHaveURL(`${origin}/invitations/accept`);
    await props.page.getByLabel("表示名", { exact: true }).fill("招待テスト");
    await props.page.getByRole("button", { name: "招待を承諾", exact: true }).click();
    await expect(props.page.getByRole("alert")).toContainText("招待が無効か期限切れです");
    await expect(props.page.getByLabel("表示名", { exact: true })).toHaveValue("招待テスト");
    await props.page.reload();
    await expect(props.page.getByLabel("表示名", { exact: true })).toBeVisible();
    await props.page.getByRole("button", { name: "招待を閉じる" }).click();
    await expect(props.page.getByRole("alert")).toContainText("招待リンクが無効か見つかりません");
    await props.page.reload();
    await expect(props.page.getByRole("alert")).toContainText("招待リンクが無効か見つかりません");
    await expect(props.page.getByRole("button", { name: "招待を承諾", exact: true })).toHaveCount(
      0,
    );
  });
}

test("新しい招待と不正リンクは古い招待を置き換え、閉じた後に履歴で復活しない", async (props) => {
  await props.page.goto(`/invitations/accept#${firstToken}`);
  await expect(props.page).toHaveURL(/\/invitations\/accept$/);
  await props.page.getByLabel("表示名", { exact: true }).fill("以前の入力");
  await props.page.goto(`/invitations/accept#${secondToken}`);
  await expect(props.page).toHaveURL(/\/invitations\/accept$/);
  await expect(props.page.getByLabel("表示名", { exact: true })).toHaveValue("");
  await props.page.goto("/invitations/accept#invalid");
  await expect(props.page).toHaveURL(/\/invitations\/accept$/);
  await expect(props.page.getByRole("alert")).toContainText("招待リンクが無効か見つかりません");
  await props.page.goBack();
  await expect(props.page).toHaveURL(/\/invitations\/accept$/);
  await expect(props.page.getByRole("alert")).toContainText("招待リンクが無効か見つかりません");
  await props.page.goForward();
  await expect(props.page.getByRole("alert")).toContainText("招待リンクが無効か見つかりません");
});
