import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

// --- Global flush-on-tab-switch support -------------------------------------
// These components debounce writes via setTimeout. When the user switches browser
// tabs quickly, the timeout may not fire before the page becomes hidden.
// We register each debounced field's "flush" function in a module-level set and
// trigger them all on visibility/page lifecycle events.

type Flusher = () => void;
const debouncedFlushers = new Set<Flusher>();
let flushListenersInitialized = false;

function initDebouncedFlushListeners() {
  if (flushListenersInitialized) return;
  flushListenersInitialized = true;

  const flushAll = () => {
    // Copy to array to avoid issues if a flusher unregisters during iteration.
    Array.from(debouncedFlushers).forEach((flush) => {
      try {
        flush();
      } catch (e) {
        // Never block other flushers.
        console.warn("Failed to flush debounced input:", e);
      }
    });
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAll();
  });
  // pagehide fires reliably on tab close / navigation (including bfcache).
  window.addEventListener("pagehide", flushAll);
  // beforeunload is best-effort; still flush synchronously.
  window.addEventListener("beforeunload", flushAll);
}

interface DebouncedInputProps extends Omit<React.ComponentProps<typeof Input>, 'onChange'> {
  value: string;
  onSave: (value: string) => void;
  debounceMs?: number;
}

export function DebouncedInput({ 
  value, 
  onSave, 
  debounceMs = 800, 
  className,
  ...props 
}: DebouncedInputProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = React.useRef(value);
  const localValueRef = React.useRef(localValue);
  const onSaveRef = React.useRef(onSave);
  const flushRef = React.useRef<() => void>(() => {});

  // Keep refs in sync for global flushers
  React.useEffect(() => {
    localValueRef.current = localValue;
  }, [localValue]);

  React.useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Sync local value when prop changes from external updates
  React.useEffect(() => {
    if (value !== lastSavedRef.current) {
      setLocalValue(value);
      lastSavedRef.current = value;
    }
  }, [value]);

  // A stable "flush" implementation that always reads the latest refs.
  flushRef.current = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const current = localValueRef.current;
    if (current !== lastSavedRef.current) {
      onSaveRef.current(current);
      lastSavedRef.current = current;
    }
  };

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      if (newValue !== lastSavedRef.current) {
        onSave(newValue);
        lastSavedRef.current = newValue;
      }
    }, debounceMs);
  }, [onSave, debounceMs]);

  const handleBlur = React.useCallback(() => {
    flushRef.current();
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    initDebouncedFlushListeners();

    const flusher: Flusher = () => flushRef.current();
    debouncedFlushers.add(flusher);

    return () => {
      debouncedFlushers.delete(flusher);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Input
      {...props}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn(className)}
    />
  );
}

interface DebouncedTextareaProps extends Omit<React.ComponentProps<typeof Textarea>, 'onChange'> {
  value: string;
  onSave: (value: string) => void;
  debounceMs?: number;
}

export function DebouncedTextarea({ 
  value, 
  onSave, 
  debounceMs = 800, 
  className,
  ...props 
}: DebouncedTextareaProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = React.useRef(value);
  const localValueRef = React.useRef(localValue);
  const onSaveRef = React.useRef(onSave);
  const flushRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    localValueRef.current = localValue;
  }, [localValue]);

  React.useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Sync local value when prop changes from external updates
  React.useEffect(() => {
    if (value !== lastSavedRef.current) {
      setLocalValue(value);
      lastSavedRef.current = value;
    }
  }, [value]);

  flushRef.current = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const current = localValueRef.current;
    if (current !== lastSavedRef.current) {
      onSaveRef.current(current);
      lastSavedRef.current = current;
    }
  };

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      if (newValue !== lastSavedRef.current) {
        onSave(newValue);
        lastSavedRef.current = newValue;
      }
    }, debounceMs);
  }, [onSave, debounceMs]);

  const handleBlur = React.useCallback(() => {
    flushRef.current();
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    initDebouncedFlushListeners();

    const flusher: Flusher = () => flushRef.current();
    debouncedFlushers.add(flusher);

    return () => {
      debouncedFlushers.delete(flusher);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Textarea
      {...props}
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn(className)}
    />
  );
}

interface DebouncedNumberInputProps extends Omit<React.ComponentProps<typeof Input>, 'onChange' | 'type'> {
  value: number | null | undefined;
  onSave: (value: number | null) => void;
  debounceMs?: number;
}

export function DebouncedNumberInput({ 
  value, 
  onSave, 
  debounceMs = 800, 
  className,
  ...props 
}: DebouncedNumberInputProps) {
  const [localValue, setLocalValue] = React.useState(value?.toString() ?? "");
  const timeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = React.useRef(value);
  const localValueRef = React.useRef(localValue);
  const onSaveRef = React.useRef(onSave);
  const flushRef = React.useRef<() => void>(() => {});

  React.useEffect(() => {
    localValueRef.current = localValue;
  }, [localValue]);

  React.useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Sync local value when prop changes from external updates
  React.useEffect(() => {
    if (value !== lastSavedRef.current) {
      setLocalValue(value?.toString() ?? "");
      lastSavedRef.current = value;
    }
  }, [value]);

  flushRef.current = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    const raw = localValueRef.current;
    const numValue = raw ? parseFloat(raw) : null;
    if (numValue !== lastSavedRef.current) {
      onSaveRef.current(numValue);
      lastSavedRef.current = numValue;
    }
  };

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    
    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    // Set new timeout for debounced save
    timeoutRef.current = setTimeout(() => {
      const numValue = newValue ? parseFloat(newValue) : null;
      if (numValue !== lastSavedRef.current) {
        onSave(numValue);
        lastSavedRef.current = numValue;
      }
    }, debounceMs);
  }, [onSave, debounceMs]);

  const handleBlur = React.useCallback(() => {
    flushRef.current();
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    initDebouncedFlushListeners();

    const flusher: Flusher = () => flushRef.current();
    debouncedFlushers.add(flusher);

    return () => {
      debouncedFlushers.delete(flusher);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      pattern="[0-9]*\.?[0-9]*"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn(className)}
    />
  );
}
