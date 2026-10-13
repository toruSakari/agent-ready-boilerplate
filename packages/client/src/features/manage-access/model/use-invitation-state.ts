import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import {
  INVITATION_PATH,
  INVITATION_STORAGE_KEY,
  readPendingInvitation,
} from "#client/features/manage-access/model/invitation-session";
import {
  EMPTY_INVITATION_ENTRY,
  readBrowserInvitation,
  nextInvitationState,
} from "#client/features/manage-access/model/invitation-browser";

export function useInvitationState() {
  const pathname = useLocation().pathname;
  const [readyPath, setReadyPath] = useState<string | null>(null);
  const [entry, setEntry] = useState({ ...EMPTY_INVITATION_ENTRY, revision: 0 });
  const [scrubFailed, setScrubFailed] = useState(false);
  const current = useRef(entry);
  useEffect(() => {
    function capture() {
      const hasIncomingToken =
        window.location.pathname === INVITATION_PATH && !!window.location.hash;
      const next = readBrowserInvitation(window);
      if (next === null) {
        setScrubFailed(true);
        return;
      }

      setScrubFailed(false);
      const updated = nextInvitationState(next, current.current, hasIncomingToken);
      current.current = updated;
      setEntry(updated);
      setReadyPath(window.location.pathname);
    }
    capture();
    window.addEventListener("hashchange", capture);
    window.addEventListener("popstate", capture);
    return () => {
      window.removeEventListener("hashchange", capture);
      window.removeEventListener("popstate", capture);
    };
  }, [pathname]);
  function clear(token: string, revision: number) {
    // 古い承諾の完了が新しいリンクや閉じた画面を上書きしない。
    if (current.current.invitation?.token !== token || current.current.revision !== revision) {
      return false;
    }

    try {
      const stored = readPendingInvitation(window.sessionStorage);
      if (stored?.token === token) {
        window.sessionStorage.removeItem(INVITATION_STORAGE_KEY);
      }
    } catch {
      /* 保存が消せなくても、同じ招待の再承諾はAPIが拒否する。 */
    }

    current.current = { ...EMPTY_INVITATION_ENTRY, revision };
    setEntry(current.current);
    return true;
  }
  const preparing =
    readyPath === null ||
    (readyPath !== pathname && pathname === INVITATION_PATH && !!window.location.hash);
  return { entry, clear, scrubFailed, preparing };
}
