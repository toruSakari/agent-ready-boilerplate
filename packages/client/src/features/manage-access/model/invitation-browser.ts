import {
  captureInvitation,
  INVITATION_PATH,
  readPendingInvitation,
} from "#client/features/manage-access/model/invitation-session";
import type { InvitationEntry } from "#client/features/manage-access/model/invitation-session";

export type InvitationState = InvitationEntry & { revision: number };

export const EMPTY_INVITATION_ENTRY: InvitationEntry = { invitation: null, error: null };

export function readBrowserInvitation(browser: Window): InvitationEntry | null {
  try {
    return browser.location.pathname === INVITATION_PATH
      ? captureInvitation(browser)
      : { invitation: readPendingInvitation(browser.sessionStorage), error: null };
  } catch {
    // 秘密がURLに残る場合は認証SDKを初期化しない。保存だけの失敗とは区別する。
    if (browser.location.pathname === INVITATION_PATH && browser.location.hash) {
      return null;
    }

    return { invitation: null, error: "storage" };
  }
}

function preservedEntry(
  next: InvitationEntry,
  current: InvitationState,
  hasIncomingToken: boolean,
): InvitationEntry {
  // fragment消去直後の履歴イベントでも、入力・保存のエラーを消さない。
  return !hasIncomingToken && !next.invitation && !next.error && current.error
    ? { ...next, error: current.error }
    : next;
}

function entryChanged(entry: InvitationEntry, current: InvitationState) {
  return (
    entry.invitation?.token !== current.invitation?.token ||
    entry.invitation?.capturedAt !== current.invitation?.capturedAt ||
    entry.error !== current.error
  );
}

export function nextInvitationState(
  next: InvitationEntry,
  current: InvitationState,
  hasIncomingToken: boolean,
): InvitationState {
  const entry = preservedEntry(next, current, hasIncomingToken);
  return { ...entry, revision: current.revision + (entryChanged(entry, current) ? 1 : 0) };
}
