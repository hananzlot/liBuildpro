import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
  customerPhone?: string | null;
  jobAddress?: string | null;
  isResend?: boolean;
}

export function SendProposalDialog({
  open,
  onOpenChange,
  estimateId,
  customerName,
  customerEmail,
  customerPhone,
  jobAddress,
  isResend = false,
}: SendProposalDialogProps) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open) {
      setEmail(customerEmail || '');
      setSubject(
        isResend 
          ? `Reminder: Your Proposal from Capro Builders`
          : `Your Proposal from Capro Builders`
      );
      setMessage(
        isResend
          ? `Hi ${customerName},\n\nThis is a friendly reminder about your proposal. Please find it available for review through the link below.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\nCapro Builders`
          : `Hi ${customerName},\n\nPlease find your proposal attached. You can review, comment, and sign it directly through the link below.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\nCapro Builders`
      );
      setPortalLink(null);
      setCopied(false);
    }
  }, [open, customerEmail, customerName, isResend]);

  // Check if estimate already has a project
  const { data: estimateData } = useQuery({
    queryKey: ['estimate-project-check', estimateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimates')
        .select('project_id, estimate_title, job_address, customer_phone')
        .eq('id', estimateId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Check if there's an existing portal token for this project
  const { data: existingToken } = useQuery({
    queryKey: ['existing-portal-token', estimateData?.project_id],
    queryFn: async () => {
      if (!estimateData?.project_id) return null;
      const { data } = await supabase
        .from('client_portal_tokens')
        .select('*')
        .eq('project_id', estimateData.project_id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      return data;
    },
    enabled: !!estimateData?.project_id,
  });

  // Auto-set portal link if existing token found
  useEffect(() => {
    if (existingToken && !portalLink) {
      const link = `${window.location.origin}/portal?token=${existingToken.token}`;
      setPortalLink(link);
    }
  }, [existingToken, portalLink]);

  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      
      let projectId = estimateData?.project_id;
      
      // If no project exists, try to find an existing project by customer info or create one
      if (!projectId) {
        // Parse customer name into first/last
        const nameParts = customerName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const jobAddr = estimateData?.job_address || jobAddress || null;
        const customerEmailToCheck = email || customerEmail || null;

        // First, try to find an existing project by job address (most reliable match)
        let existingProject = null;
        
        if (jobAddr) {
          const { data: projectByAddress } = await supabase
            .from('projects')
            .select('id, project_name, project_number')
            .eq('project_address', jobAddr)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (projectByAddress) {
            existingProject = projectByAddress;
          }
        }

        // If no match by address, try by customer email
        if (!existingProject && customerEmailToCheck) {
          const { data: projectByEmail } = await supabase
            .from('projects')
            .select('id, project_name, project_number')
            .eq('customer_email', customerEmailToCheck)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (projectByEmail) {
            existingProject = projectByEmail;
          }
        }

        // If no match by email, try by customer name
        if (!existingProject && firstName) {
          const { data: projectByName } = await supabase
            .from('projects')
            .select('id, project_name, project_number')
            .eq('customer_first_name', firstName)
            .eq('customer_last_name', lastName)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (projectByName) {
            existingProject = projectByName;
          }
        }

        if (existingProject) {
          // Use the existing project
          projectId = existingProject.id;
          
          // Link the estimate to this existing project
          await supabase
            .from('estimates')
            .update({ project_id: projectId })
            .eq('id', estimateId);
        } else {
          // No existing project found - create a new one
          // Get the next project number
          const { data: maxProject } = await supabase
            .from('projects')
            .select('project_number')
            .order('project_number', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          const nextProjectNumber = (maxProject?.project_number || 0) + 1;

          // Create the project with status "Proposal"
          const { data: newProject, error: projectError } = await supabase
            .from('projects')
            .insert({
              project_number: nextProjectNumber,
              project_name: estimateData?.estimate_title || `Proposal - ${customerName}`,
              project_status: 'Proposal',
              customer_first_name: firstName,
              customer_last_name: lastName,
              customer_email: customerEmailToCheck,
              cell_phone: estimateData?.customer_phone || customerPhone || null,
              project_address: jobAddr,
              location_id: 'default',
              created_by: user.user?.id,
            })
            .select()
            .single();

          if (projectError) throw projectError;
          projectId = newProject.id;

          // Link the estimate to the project
          await supabase
            .from('estimates')
            .update({ project_id: projectId })
            .eq('id', estimateId);
        }
      }

      // Check if there's already an active token for this project
      const { data: existingProjectToken } = await supabase
        .from('client_portal_tokens')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (existingProjectToken) {
        // Update the token with the current estimate if needed
        if (!existingProjectToken.estimate_id || existingProjectToken.estimate_id !== estimateId) {
          await supabase
            .from('client_portal_tokens')
            .update({ 
              estimate_id: estimateId,
              client_email: email || null,
            })
            .eq('id', existingProjectToken.id);
        }
        return existingProjectToken;
      }

      // Create new portal token linked to project
      const { data, error } = await supabase
        .from('client_portal_tokens')
        .insert({
          project_id: projectId,
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
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
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
              ? 'Send a reminder email with the portal link to the client.'
              : 'Generate a secure portal for your client to view and sign the proposal.'}
            {estimateData?.project_id && (
              <span className="block mt-1 text-xs text-primary">
                Using existing project portal
              </span>
            )}
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
                {estimateData?.project_id ? 'Get Portal Link' : 'Create Portal & Generate Link'}
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
                    Refresh Link
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
