import { describe, expect, it } from "vite-plus/test";
import { safeReturnPath, signInUrl } from "#client/shared/config/auth-routes";

const origin = "https://business.example.com";
describe("認証後の戻り先ルート", () => {
  it("秘密情報を含めず招待の入口へ戻る", () => {
    expect(signInUrl("/invitations/accept")).toBe("/sign-in?returnTo=%2Finvitations%2Faccept");
    expect(safeReturnPath("/invitations/accept#secret", origin)).toBe("/invitations/accept");
    expect(safeReturnPath("/organizations/one?view=all", origin)).toBe(
      "/organizations/one?view=all",
    );
  });
  it("明示された顧客登録への戻り先を維持する", () => {
    expect(signInUrl("/register")).toBe("/sign-in?returnTo=%2Fregister");
    expect(safeReturnPath("/register#secret", origin)).toBe("/register");
  });
  // 見た目が相対パスでもURL解釈で外部へ出る値と、ログイン画面へ戻るループを同じ境界で検証する。
  it.each([
    null,
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "javascript:alert(1)",
    "/sign-in",
    "/sign-in/factor-one",
    "/\n/evil.example",
  ])("外部サイトやループを生む戻り先 %s を拒否する", (value) => {
    expect(safeReturnPath(value, origin)).toBe("/");
  });
});
