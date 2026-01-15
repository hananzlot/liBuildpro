import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Copy, Mail, Link, Check, Loader2, Send } from 'lucide-react';

interface SendProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateId: string;
  customerName: string;
  customerEmail: string | null;
  isResend?: boolean;
}

export function SendProposalDialog({
  open,
  onOpenChange,
  estimateId,
  customerName,
  customerEmail,
  isResend = false,
}: SendProposalDialogProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState(customerEmail || '');
  const [subject, setSubject] = useState(
    isResend 
      ? `Reminder: Your Proposal from Capro Builders`
      : `Your Proposal from Capro Builders`
  );
  const [message, setMessage] = useState(
    isResend
      ? `Hi ${customerName},\n\nThis is a friendly reminder about your proposal. Please find it available for review through the link below.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\nCapro Builders`
      : `Hi ${customerName},\n\nPlease find your proposal attached. You can review, comment, and sign it directly through the link below.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\nCapro Builders`
  );
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('client_portal_tokens')
        .insert({
          estimate_id: estimateId,
          client_email: email || null,
          client_name: customerName,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const link = `${window.location.origin}/portal?token=${data.token}`;
      setPortalLink(link);
      toast.success('Portal link generated!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!email) throw new Error('Email is required');
      if (!portalLink) throw new Error('Generate a link first');

      // Call edge function to send email
      const { error } = await supabase.functions.invoke('send-proposal-email', {
        body: {
          to: email,
          subject,
          message,
          portalLink,
          customerName,
          estimateId,
          isReminder: isResend,
        },
      });

      if (error) throw error;

      // Only update status if this is a first-time send (not a resend)
      if (!isResend) {
        await supabase
          .from('estimates')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', estimateId);
      }
    },
    onSuccess: () => {
      toast.success(isResend ? 'Reminder sent successfully!' : 'Proposal sent successfully!');
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const copyLink = async () => {
    if (!portalLink) return;
    await navigator.clipboard.writeText(portalLink);
    setCopied(true);
    toast.success('Link copied to clipboard!');
    setTimeout(() => setCopied(false), 2000);
  };

  const markAsSent = async () => {
    await supabase
      .from('estimates')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
      })
      .eq('id', estimateId);
    
    queryClient.invalidateQueries({ queryKey: ['estimates'] });
    toast.success('Proposal marked as sent');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isResend ? 'Resend Proposal' : 'Send Proposal'}</DialogTitle>
          <DialogDescription>
            {isResend 
              ? 'Send a reminder email with a new portal link to the client.'
              : 'Generate a secure link for your client to view and sign the proposal.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Generate Link Section */}
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Client Email (optional)</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>

            {!portalLink ? (
              <Button
                onClick={() => generateLinkMutation.mutate()}
                disabled={generateLinkMutation.isPending}
                className="w-full"
              >
                {generateLinkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link className="h-4 w-4 mr-2" />
                )}
                Generate Portal Link
              </Button>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input value={portalLink} readOnly className="text-sm" />
                  <Button variant="outline" onClick={copyLink}>
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={markAsSent} className="flex-1">
                    Mark as Sent
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPortalLink(null);
                      generateLinkMutation.mutate();
                    }}
                    className="flex-1"
                  >
                    Generate New Link
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Email Section - Only show if link is generated */}
          {portalLink && email && (
            <>
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Send via Email
                </h4>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Subject</Label>
                    <Input
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Message</Label>
                    <Textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      The portal link will be automatically included in the email.
                    </p>
                  </div>

                  <Button
                    onClick={() => sendEmailMutation.mutate()}
                    disabled={sendEmailMutation.isPending}
                    className="w-full"
                  >
                    {sendEmailMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send Email
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
