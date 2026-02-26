import { useState, useEffect, useCallback } from "react";

/**
 * useModalQueryState — persists dialog open/close state in URL query params.
 *
 * When the dialog opens, writes `?modal=<modalKey>&modalId=<recordId>` to the URL.
 * On mount, reads query params to restore open state (survives page refresh).
 * On close, removes the modal params.
 *
 * Uses `history.replaceState` (no extra history entries).
 *
 * @param modalKey  Unique string identifying this dialog (e.g. "new-project")
 * @returns { open, setOpen, recordId }
 *
 * HOW IT WORKS:
 * 1. On mount, checks if `?modal=<modalKey>` is in the URL → opens dialog.
 * 2. setOpen(true, recordId?) writes params; setOpen(false) removes them.
 * 3. Multiple modals can coexist if they use different keys, but only one
 *    `modal` param is active at a time (opening a new one replaces the old).
 */
export function useModalQueryState(modalKey: string) {
  const [open, setOpenInternal] = useState(() => {
    if (typeof window === "undefined") return false;
    const params = new URLSearchParams(window.location.search);
    return params.get("modal") === modalKey;
  });

  const [recordId, setRecordId] = useState<string | undefined>(() => {
    if (typeof window === "undefined") return undefined;
    const params = new URLSearchParams(window.location.search);
    if (params.get("modal") === modalKey) {
      return params.get("modalId") || undefined;
    }
    return undefined;
  });

  const setOpen = useCallback(
    (value: boolean, id?: string) => {
      setOpenInternal(value);

      const url = new URL(window.location.href);
      if (value) {
        url.searchParams.set("modal", modalKey);
        if (id) {
          url.searchParams.set("modalId", id);
          setRecordId(id);
        } else {
          url.searchParams.delete("modalId");
          setRecordId(undefined);
        }
      } else {
        url.searchParams.delete("modal");
        url.searchParams.delete("modalId");
        setRecordId(undefined);
      }

      window.history.replaceState(null, "", url.toString());
    },
    [modalKey]
  );

  // Listen for popstate (back/forward) to sync state
  useEffect(() => {
    const handler = () => {
      const params = new URLSearchParams(window.location.search);
      const isOpen = params.get("modal") === modalKey;
      setOpenInternal(isOpen);
      setRecordId(isOpen ? params.get("modalId") || undefined : undefined);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, [modalKey]);

  return { open, setOpen, recordId } as const;
}
