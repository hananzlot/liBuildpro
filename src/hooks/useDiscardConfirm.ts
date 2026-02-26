import { useState, useCallback } from "react";

/**
 * useDiscardConfirm — guards dialog close when a form is dirty.
 *
 * HOW IT WORKS:
 * 1. Wrap your dialog's onOpenChange with `handleOpenChange`.
 * 2. If the form is dirty and user tries to close, `showConfirm` becomes true.
 * 3. Render an AlertDialog when `showConfirm` is true.
 * 4. Call `confirmDiscard()` to clear draft + close, or `cancelDiscard()` to stay open.
 *
 * @param isDirty    Whether the form has unsaved changes
 * @param onClose    Actual close handler (e.g. setOpen(false) + clearDraft)
 * @param onOpen     Optional handler when opening (e.g. setOpen(true))
 */
export function useDiscardConfirm(
  isDirty: boolean,
  onClose: () => void,
  onOpen?: () => void
) {
  const [showConfirm, setShowConfirm] = useState(false);

  /** Use this as onOpenChange for the Dialog */
  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        onOpen?.();
        return;
      }
      // Trying to close
      if (isDirty) {
        setShowConfirm(true);
      } else {
        onClose();
      }
    },
    [isDirty, onClose, onOpen]
  );

  /** User confirmed they want to discard */
  const confirmDiscard = useCallback(() => {
    setShowConfirm(false);
    onClose();
  }, [onClose]);

  /** User cancelled the discard prompt */
  const cancelDiscard = useCallback(() => {
    setShowConfirm(false);
  }, []);

  return { showConfirm, handleOpenChange, confirmDiscard, cancelDiscard } as const;
}
