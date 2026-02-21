import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "persisted-dialog";
const TTL_MS = 30 * 60 * 1000; // 30 minutes

interface PersistedDialogState {
  open: boolean;
  type: string;
  id?: string;
  timestamp: number;
}

function readPersistedState(): PersistedDialogState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const state: PersistedDialogState = JSON.parse(raw);
    if (Date.now() - state.timestamp > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return state.open ? state : null;
  } catch {
    return null;
  }
}

function writePersistedState(type: string, id?: string) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ open: true, type, id, timestamp: Date.now() } satisfies PersistedDialogState)
  );
}

function clearPersistedState() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Hook that persists dialog open state to localStorage so it survives tab switches and refreshes.
 * Returns [open, setOpen, persistedType] — the persisted type lets callers restore the correct mode.
 */
export function usePersistedDialog(dialogType: string, id?: string) {
  const [open, setOpenInternal] = useState(() => {
    const persisted = readPersistedState();
    return persisted?.type === dialogType && persisted.open;
  });

  const setOpen = useCallback(
    (value: boolean) => {
      setOpenInternal(value);
      if (value) {
        writePersistedState(dialogType, id);
      } else {
        clearPersistedState();
      }
    },
    [dialogType, id]
  );

  // On mount, if persisted state matches this type, open the dialog
  useEffect(() => {
    const persisted = readPersistedState();
    if (persisted?.type === dialogType && persisted.open) {
      setOpenInternal(true);
    }
  }, [dialogType]);

  return { open, setOpen } as const;
}

/**
 * Read persisted dialog state without binding to a specific type.
 * Useful for a parent component to determine which dialog type to restore.
 */
export function getPersistedDialogState(): { type: string; id?: string } | null {
  return readPersistedState();
}
