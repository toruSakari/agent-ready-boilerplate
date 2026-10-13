import { z } from "zod";

export const INVITATION_PATH = "/invitations/accept";
export const INVITATION_STORAGE_KEY = "dev-template.pending-invitation.v1";
// これはブラウザーでの保持上限。発行時からの有効期限と一度だけの承諾はAPIが管理する。
export const INVITATION_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const INVITATION_TOKEN_HEX_LENGTH = 64;
const invitationToken = new RegExp(`^[a-f0-9]{${INVITATION_TOKEN_HEX_LENGTH}}$`);

export type PendingInvitation = { token: string; capturedAt: number };

export type InvitationEntry = {
  invitation: PendingInvitation | null;
  error: "invalid" | "storage" | null;
};

const pendingInvitationSchema = z.object({
  token: z.string().regex(invitationToken),
  capturedAt: z.number().finite(),
});

function validCaptureTime(capturedAt: number, now: number) {
  return capturedAt <= now && now - capturedAt < INVITATION_RETENTION_MS;
}

/** 保存値も未検証入力として扱う。壊れた値・未来の時刻・保持期限切れは保持対象から外す。 */
export function readPendingInvitation(
  storage: Storage,
  now = Date.now(),
): PendingInvitation | null {
  const raw = storage.getItem(INVITATION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);
    const parsed = pendingInvitationSchema.safeParse(value);
    if (parsed.success && validCaptureTime(parsed.data.capturedAt, now)) {
      return parsed.data;
    }
  } catch {
    // 壊れた保存値を招待なしとして扱い、不正なトークンをAPIへ送らない。
  }

  storage.removeItem(INVITATION_STORAGE_KEY);
  return null;
}

/**
 * 招待fragmentを同一タブのsessionStorageへ移し、認証遷移より前にURLから取り除く。
 * URL消去の例外は呼び出し元へ返すため、その場合は認証遷移を開始しないこと。
 */
export function captureInvitation(browser: Window, now = Date.now()): InvitationEntry {
  const incoming = browser.location.hash.slice(1);
  try {
    const storage = browser.sessionStorage;
    if (incoming) {
      // 新しいリンクが不正でも旧招待へフォールバックしない。別の招待を誤って承諾するのを避ける。
      if (!invitationToken.test(incoming)) {
        storage.removeItem(INVITATION_STORAGE_KEY);
        return { invitation: null, error: "invalid" };
      }

      const previous = readPendingInvitation(storage, now);
      // 保持期限内の同じリンクでは捕捉時刻を延長せず、ブラウザーの保持期限を固定する。
      const invitation =
        previous?.token === incoming ? previous : { token: incoming, capturedAt: now };
      storage.removeItem(INVITATION_STORAGE_KEY);
      storage.setItem(INVITATION_STORAGE_KEY, JSON.stringify(invitation));
      return { invitation, error: null };
    }

    return { invitation: readPendingInvitation(storage, now), error: null };
  } catch {
    return { invitation: null, error: "storage" };
  } finally {
    // 保存失敗時にも秘密をURLに残さない。ルーターの履歴状態と秘密でないクエリは保持する。
    // 認証先へのリダイレクトで元fragmentが継承される前に取り除く。
    if (browser.location.hash) {
      browser.history.replaceState(
        browser.history.state,
        "",
        browser.location.pathname + browser.location.search,
      );
    }
  }
}
