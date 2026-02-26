import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Track whether the document is currently hidden (tab switched away).
 * We use a module-level flag updated via visibilitychange because
 * document.hasFocus() is unreliable at the exact moment Radix fires events.
 */
let isDocumentHidden = typeof document !== "undefined" && document.visibilityState === "hidden";

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    isDocumentHidden = document.visibilityState === "hidden";
  });
}

const Dialog = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root>
>(({ onOpenChange, ...props }, _ref) => (
  <DialogPrimitive.Root
    onOpenChange={(open) => {
      // Block Radix from closing dialogs when the browser tab is hidden.
      if (!open && isDocumentHidden) {
        return;
      }
      onOpenChange?.(open);
    }}
    {...props}
  />
));
Dialog.displayName = "Dialog";

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/60 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className,
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

interface DialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> {
  hideCloseButton?: boolean;
  /** When true, renders inline without portal/overlay (for page mode) */
  disablePortal?: boolean;
}

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(({ className, children, onFocusOutside, onInteractOutside, onEscapeKeyDown, hideCloseButton, disablePortal, ...props }, ref) => {
  const content = (
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        disablePortal 
          ? "relative w-full h-full flex flex-col border-0 bg-background"
          : "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className,
      )}
      onFocusOutside={(e) => {
        // Always prevent focus-outside from closing dialogs.
        e.preventDefault();
        onFocusOutside?.(e);
      }}
      onInteractOutside={(e) => {
        // Always prevent interact-outside from closing dialogs.
        // Users close via X button, Cancel, or explicit actions.
        e.preventDefault();
        onInteractOutside?.(e);
      }}
      onEscapeKeyDown={(e) => {
        onEscapeKeyDown?.(e);
        if (!e.defaultPrevented) e.preventDefault();
      }}
      {...props}
    >
      {children}
      {!hideCloseButton && !disablePortal && (
        <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity data-[state=open]:bg-accent data-[state=open]:text-muted-foreground hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  );

  if (disablePortal) {
    return content;
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      {content}
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)} {...props} />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
