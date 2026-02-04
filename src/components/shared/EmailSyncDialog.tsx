import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, Users, Briefcase, FileText, Building2 } from "lucide-react";
import { useEmailSync } from "@/hooks/useEmailSync";

interface EmailSyncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactUuid: string | null | undefined;
  oldEmail: string | null | undefined;
  newEmail: string;
  onSyncConfirmed: () => void;
  onUpdateLocalOnly: () => void;
}

export function EmailSyncDialog({
  open,
  onOpenChange,
  contactUuid,
  oldEmail,
  newEmail,
  onSyncConfirmed,
  onUpdateLocalOnly,
}: EmailSyncDialogProps) {
  const { linkedCounts, isLoadingCounts, syncEmail, isSyncing } = useEmailSync(contactUuid);

  const totalLinked = linkedCounts
    ? linkedCounts.opportunities + linkedCounts.projects + linkedCounts.estimates
    : 0;

  const handleSyncAll = () => {
    if (!contactUuid) return;
    syncEmail(
      { contactUuid, newEmail },
      {
        onSuccess: () => {
          onSyncConfirmed();
          onOpenChange(false);
        },
      }
    );
  };

  const handleLocalOnly = () => {
    onUpdateLocalOnly();
    onOpenChange(false);
  };

  // If no contact linked, just update locally
  if (!contactUuid) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Update Email Across Records?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4">
              <p>
                You're changing the email from{" "}
                <span className="font-medium text-foreground">{oldEmail || "(none)"}</span> to{" "}
                <span className="font-medium text-foreground">{newEmail}</span>
              </p>

              {linkedCounts?.contactName && (
                <p className="text-sm">
                  Contact: <span className="font-medium">{linkedCounts.contactName}</span>
                </p>
              )}

              {isLoadingCounts ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : totalLinked > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">This will update email in:</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" />
                      1 Contact
                    </Badge>
                    {linkedCounts!.opportunities > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <Briefcase className="h-3 w-3" />
                        {linkedCounts!.opportunities} Opportunit{linkedCounts!.opportunities === 1 ? "y" : "ies"}
                      </Badge>
                    )}
                    {linkedCounts!.projects > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <Building2 className="h-3 w-3" />
                        {linkedCounts!.projects} Project{linkedCounts!.projects === 1 ? "" : "s"}
                      </Badge>
                    )}
                    {linkedCounts!.estimates > 0 && (
                      <Badge variant="secondary" className="gap-1">
                        <FileText className="h-3 w-3" />
                        {linkedCounts!.estimates} Estimate{linkedCounts!.estimates === 1 ? "" : "s"}
                      </Badge>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No other records are linked to this contact.
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel disabled={isSyncing}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleLocalOnly}
            disabled={isSyncing}
            className="sm:order-first bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Update Here Only
          </AlertDialogAction>
          <AlertDialogAction onClick={handleSyncAll} disabled={isSyncing || isLoadingCounts}>
            {isSyncing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Update All Records
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
