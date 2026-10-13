import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import {
  captureInvitation,
  readPendingInvitation,
  INVITATION_PATH,
  INVITATION_RETENTION_MS,
  INVITATION_STORAGE_KEY,
} from "#client/features/manage-access/model/invitation-session";

const firstToken = "a".repeat(64);
const secondToken = "b".repeat(64);
const now = Date.parse("2026-10-04T00:00:00Z");
beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState({ router: "preserved" }, "", INVITATION_PATH);
});
afterEach(() => vi.restoreAllMocks());

// 時刻とブラウザー状態を固定し、リンク差し替え・期限・保存拒否でも秘密や旧招待を残さないことを検証する。
it(
  "ブラウザーでの招待の保持" +
    " / " +
    "認証前に保存してURLのフラグメントだけを除去し、再読み込み後も保持する",
  () => {
    window.history.replaceState(
      { router: "preserved" },
      "",
      `${INVITATION_PATH}?lang=ja#${firstToken}`,
    );
    expect(captureInvitation(window, now).invitation?.token).toBe(firstToken);
    expect(window.location.hash).toBe("");
    expect(window.location.search).toBe("?lang=ja");
    expect(window.history.state).toEqual({ router: "preserved" });
    expect(captureInvitation(window, now + 1).invitation).toEqual({
      token: firstToken,
      capturedAt: now,
    });
    expect(window.localStorage.getItem(INVITATION_STORAGE_KEY)).toBeNull();
  },
);

it("ブラウザーでの招待の保持" + " / " + "2つ目のリンクで以前の招待を置き換える", () => {
  window.location.hash = firstToken;
  captureInvitation(window, now);
  window.location.hash = secondToken;
  expect(captureInvitation(window, now).invitation?.token).toBe(secondToken);
  expect(readPendingInvitation(window.sessionStorage, now)?.token).toBe(secondToken);
});

it.each(["bad-token", "a".repeat(63), `${firstToken}/factor-one`, "%zz"])(
  "ブラウザーでの招待の保持" + " / " + "不正な入力を拒否し、以前の招待に戻さない: %s",
  (bad) => {
    window.location.hash = firstToken;
    captureInvitation(window, now);
    window.location.hash = bad;
    expect(captureInvitation(window, now)).toEqual({ invitation: null, error: "invalid" });
    expect(window.location.hash).toBe("");
    expect(window.sessionStorage.getItem(INVITATION_STORAGE_KEY)).toBeNull();
  },
);

it(
  "ブラウザーでの招待の保持" + " / " + "ブラウザーでの保持期限を切らし、再読み込みで延長しない",
  () => {
    window.location.hash = firstToken;
    captureInvitation(window, now);
    expect(
      captureInvitation(window, now + INVITATION_RETENTION_MS - 1).invitation?.capturedAt,
    ).toBe(now);
    expect(captureInvitation(window, now + INVITATION_RETENTION_MS).invitation).toBeNull();
    expect(window.sessionStorage.getItem(INVITATION_STORAGE_KEY)).toBeNull();
  },
);

it.each([
  "not-json",
  JSON.stringify({ token: firstToken, capturedAt: now + 1 }),
  JSON.stringify({ token: "bad", capturedAt: now }),
])(
  "ブラウザーでの招待の保持" + " / " + "破損した保存値や未来の日時を持つ保存値を破棄する",
  (raw) => {
    window.sessionStorage.setItem(INVITATION_STORAGE_KEY, raw);
    expect(readPendingInvitation(window.sessionStorage, now)).toBeNull();
    expect(window.sessionStorage.getItem(INVITATION_STORAGE_KEY)).toBeNull();
  },
);

it(
  "ブラウザーでの招待の保持" +
    " / " +
    "ブラウザーの保存領域が利用できなくてもURLから招待トークンを除去する",
  () => {
    window.location.hash = firstToken;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    expect(captureInvitation(window, now)).toEqual({ invitation: null, error: "storage" });
    expect(window.location.hash).toBe("");
  },
);
