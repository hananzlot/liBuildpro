import { useRef, useEffect, useCallback } from "react";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const DEBOUNCE_MS = 300;

interface DraftEnvelope<T> {
  values: T;
  updatedAt: number;
  version: number;
}

function buildKey(dialogName: string, recordId?: string): string {
  return `dialogDraft:${dialogName}:${recordId ?? "new"}`;
}

function readDraft<T>(key: string, version: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const envelope: DraftEnvelope<T> = JSON.parse(raw);
    if (envelope.version !== version) {
      localStorage.removeItem(key);
      return null;
    }
    if (Date.now() - envelope.updatedAt > TTL_MS) {
      localStorage.removeItem(key);
      return null;
    }
    return envelope.values;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, values: T, version: number): void {
  try {
    const envelope: DraftEnvelope<T> = { values, updatedAt: Date.now(), version };
    localStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

function clearDraft(key: string): void {
  localStorage.removeItem(key);
}

/**
 * Persists form values to localStorage with debouncing, TTL (24h), and schema versioning.
 *
 * @param dialogName  Unique dialog identifier (e.g. "newEntry")
 * @param recordId    Optional record id to scope drafts per-record
 * @param version     Schema version number — bump when form shape changes to invalidate old drafts
 * @param enabled     Whether persistence is active (e.g. only when dialog is open)
 */
export function useFormDraft<T>(
  dialogName: string,
  recordId: string | undefined,
  version: number,
  enabled: boolean
) {
  const key = buildKey(dialogName, recordId);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keyRef = useRef(key);
  keyRef.current = key;

  /** Read existing draft (call once on mount / dialog open). Returns null if none or expired. */
  const restore = useCallback((): T | null => {
    return readDraft<T>(key, version);
  }, [key, version]);

  /** Persist latest values (debounced). Call on every form change. */
  const persist = useCallback(
    (values: T) => {
      if (!enabled) return;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        writeDraft(keyRef.current, values, version);
      }, DEBOUNCE_MS);
    },
    [enabled, version]
  );

  /** Clear draft — call on successful submit or explicit discard. */
  const discard = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    clearDraft(keyRef.current);
  }, []);

  /** Whether a draft exists right now */
  const hasDraft = useCallback((): boolean => {
    return readDraft<T>(key, version) !== null;
  }, [key, version]);

  // Cleanup pending timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { restore, persist, discard, hasDraft };
}
