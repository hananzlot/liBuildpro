import { useState, useEffect, useRef, useCallback } from "react";

const DEBOUNCE_MS = 400;

/**
 * usePersistentDraft — persists form draft values in sessionStorage.
 *
 * HOW IT WORKS:
 * 1. On mount (or when `enabled` becomes true), loads any existing draft from sessionStorage.
 * 2. `updateDraft(partial)` merges partial values into draft and debounce-saves to sessionStorage.
 * 3. `clearDraft()` removes the draft key (call on successful submit or explicit discard).
 * 4. `isDirty` is true when draft differs from `initialValues`.
 *
 * KEY FORMAT: `draft:<modalKey>:<recordId|new>`
 *
 * @param modalKey      Unique dialog identifier (e.g. "new-project")
 * @param initialValues Default/empty form values (also used for dirty check)
 * @param recordId      Optional record id for per-record drafts
 * @param enabled       Whether the draft is active (typically: dialog is open)
 */
export function usePersistentDraft<T extends Record<string, any>>(
  modalKey: string,
  initialValues: T,
  recordId?: string,
  enabled: boolean = true
) {
  const storageKey = `draft:${modalKey}:${recordId || "new"}`;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;
  // When setFullDraft is called, skip the next useEffect reload to avoid overwriting explicit values
  const skipNextLoadRef = useRef(false);

  // Load draft from sessionStorage or fall back to initialValues
  const [draft, setDraft] = useState<T>(() => {
    if (!enabled) return initialValues;
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        return { ...initialValues, ...parsed };
      }
    } catch {
      // ignore
    }
    return initialValues;
  });

  // Re-load when storageKey or enabled changes
  useEffect(() => {
    if (!enabled) return;
    // If setFullDraft was just called, skip this reload to preserve explicitly set values
    if (skipNextLoadRef.current) {
      skipNextLoadRef.current = false;
      return;
    }
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as T;
        setDraft((prev) => ({ ...initialValues, ...parsed }));
      } else {
        setDraft(initialValues);
      }
    } catch {
      setDraft(initialValues);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, enabled]);

  // Debounced save to sessionStorage
  const saveToStorage = useCallback(
    (values: T) => {
      if (!enabled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          sessionStorage.setItem(storageKeyRef.current, JSON.stringify(values));
        } catch {
          // Storage full — silently ignore
        }
      }, DEBOUNCE_MS);
    },
    [enabled]
  );

  /** Merge partial values into draft and debounce-save */
  const updateDraft = useCallback(
    (partial: Partial<T>) => {
      setDraft((prev) => {
        const next = { ...prev, ...partial };
        saveToStorage(next);
        return next;
      });
    },
    [saveToStorage]
  );

  /** Replace the entire draft */
  const setFullDraft = useCallback(
    (values: T) => {
      skipNextLoadRef.current = true;
      setDraft(values);
      saveToStorage(values);
    },
    [saveToStorage]
  );

  /** Clear draft from sessionStorage (call on submit success or explicit discard) */
  const clearDraft = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    try {
      sessionStorage.removeItem(storageKeyRef.current);
    } catch {
      // ignore
    }
    setDraft(initialValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Whether draft differs from initialValues */
  const isDirty = JSON.stringify(draft) !== JSON.stringify(initialValues);

  // Cleanup pending timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { draft, updateDraft, setFullDraft, clearDraft, isDirty } as const;
}
