import * as React from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = React.useRef(value);

  // Sync local value when prop changes from external updates
  React.useEffect(() => {
    if (value !== lastSavedRef.current) {
      setLocalValue(value);
      lastSavedRef.current = value;
    }
  }, [value]);

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
    // Clear timeout and save immediately on blur
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (localValue !== lastSavedRef.current) {
      onSave(localValue);
      lastSavedRef.current = localValue;
    }
  }, [localValue, onSave]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
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
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = React.useRef(value);

  // Sync local value when prop changes from external updates
  React.useEffect(() => {
    if (value !== lastSavedRef.current) {
      setLocalValue(value);
      lastSavedRef.current = value;
    }
  }, [value]);

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
    // Clear timeout and save immediately on blur
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (localValue !== lastSavedRef.current) {
      onSave(localValue);
      lastSavedRef.current = localValue;
    }
  }, [localValue, onSave]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
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
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastSavedRef = React.useRef(value);

  // Sync local value when prop changes from external updates
  React.useEffect(() => {
    if (value !== lastSavedRef.current) {
      setLocalValue(value?.toString() ?? "");
      lastSavedRef.current = value;
    }
  }, [value]);

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
    // Clear timeout and save immediately on blur
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    const numValue = localValue ? parseFloat(localValue) : null;
    if (numValue !== lastSavedRef.current) {
      onSave(numValue);
      lastSavedRef.current = numValue;
    }
  }, [localValue, onSave]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return (
    <Input
      {...props}
      type="number"
      value={localValue}
      onChange={handleChange}
      onBlur={handleBlur}
      className={cn(className)}
    />
  );
}
