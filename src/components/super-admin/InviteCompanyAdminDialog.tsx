import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Mail, Copy, Check, Loader2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InviteCompanyAdminDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: {
    id: string;
    name: string;
  } | null;
}

export function InviteCompanyAdminDialog({
  open,
  onOpenChange,
  company,
}: InviteCompanyAdminDialogProps) {
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [result, setResult] = useState<{ tempPassword: string | null; isExistingUser: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!company) throw new Error("No company selected");

      const { data, error } = await supabase.functions.invoke("send-company-invite", {
        body: {
          email,
          fullName,
          companyId: company.id,
          companyName: company.name,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      return data;
    },
    onSuccess: (data) => {
      setResult({ tempPassword: data.tempPassword, isExistingUser: data.isExistingUser });
      toast.success(data.isExistingUser 
        ? "Existing user reassigned to this company!" 
        : "Invitation sent successfully!");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to send invitation");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) {
      toast.error("Please fill in all fields");
      return;
    }
    inviteMutation.mutate();
  };

  const handleCopyPassword = async () => {
    if (result?.tempPassword) {
      await navigator.clipboard.writeText(result.tempPassword);
      setCopied(true);
      toast.success("Password copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setEmail("");
    setFullName("");
    setResult(null);
    setCopied(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Invite Company Admin
          </DialogTitle>
          <DialogDescription>
            {company ? (
              <>Send an invitation to set up <strong>{company.name}</strong></>
            ) : (
              "Select a company first"
            )}
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-4">
            <Alert className="border-primary/20 bg-primary/5">
              <Check className="h-4 w-4 text-primary" />
              <AlertDescription className="text-foreground">
                {result.isExistingUser 
                  ? "Existing user has been reassigned to this company as an admin. They'll see the change on their next login."
                  : "Invitation sent! The new admin will receive an email with login instructions."}
              </AlertDescription>
            </Alert>

            {result.tempPassword && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">
                  Backup: Temporary Password
                </Label>
                <div className="flex gap-2">
                  <Input
                    value={result.tempPassword}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyPassword}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Share this password manually if the email doesn't arrive.
                </p>
              </div>
            )}

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                placeholder="John Smith"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={inviteMutation.isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={inviteMutation.isPending}
              />
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                The admin will receive an email with a temporary password and will be guided through onboarding upon first login.
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={inviteMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending || !company}>
                {inviteMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4 mr-2" />
                    Send Invitation
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
