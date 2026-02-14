import React, { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyContext } from '@/hooks/useCompanyContext';
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
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Copy, Mail, Link, Check, Loader2, Send, Users, User, Eye, EyeOff } from 'lucide-react';
import { MultiSignerInput, SignerData } from '@/components/documents/MultiSignerInput';

interface SendProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  estimateId: string;
  customerName: string;
  customerEmail: string | null;
  customerPhone?: string | null;
  jobAddress?: string | null;
  isResend?: boolean;
  onSuccess?: () => void;
  companyId?: string | null;
}

const SIGNER_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899",
];

export function SendProposalDialog({
  open,
  onOpenChange,
  estimateId,
  customerName,
  customerEmail,
  customerPhone,
  jobAddress,
  isResend = false,
  onSuccess,
  companyId: companyIdProp,
}: SendProposalDialogProps) {
  const { companyId: contextCompanyId } = useCompanyContext();
  const companyId = companyIdProp || contextCompanyId;
  const queryClient = useQueryClient();
  const [multipleSigners, setMultipleSigners] = useState(false);
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [portalLink, setPortalLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [signers, setSigners] = useState<SignerData[]>([]);
  const [didSyncPrimarySigner, setDidSyncPrimarySigner] = useState(false);
  const [visibilitySettings, setVisibilitySettings] = useState({
    show_scope_to_customer: false,
    show_line_items_to_customer: false,
    show_details_to_customer: false,
  });

  // Fetch company name and base URL from settings (try company_settings first)
  const { data: companySettings } = useQuery({
    queryKey: ['company-settings-for-proposal', companyId],
    queryFn: async () => {
      const settingKeys = ['company_name', 'app_base_url'];
      
      // Try company_settings first if we have companyId from context
      if (companyId) {
        const { data: companyData } = await supabase
          .from('company_settings')
          .select('setting_key, setting_value')
          .eq('company_id', companyId)
          .in('setting_key', settingKeys);
        
        const companyMap = new Map(companyData?.map(s => [s.setting_key, s.setting_value]) || []);
        
        // Check if we have the needed settings
        if (companyMap.get('company_name') || companyMap.get('app_base_url')) {
          // Fall back to app_settings for any missing keys
          const { data: appData } = await supabase
            .from('app_settings')
            .select('setting_key, setting_value')
            .in('setting_key', settingKeys);
          
          const appMap = new Map(appData?.map(s => [s.setting_key, s.setting_value]) || []);
          
          return {
            companyName: companyMap.get('company_name') || appMap.get('company_name') || 'Our Company',
            appBaseUrl: companyMap.get('app_base_url') || appMap.get('app_base_url') || window.location.origin,
          };
        }
      }
      
      // Fall back to app_settings
      const { data } = await supabase
        .from('app_settings')
        .select('setting_key, setting_value')
        .in('setting_key', settingKeys);
      
      const appMap = new Map(data?.map(s => [s.setting_key, s.setting_value]) || []);
      return {
        companyName: appMap.get('company_name') || 'Our Company',
        appBaseUrl: appMap.get('app_base_url') || window.location.origin,
      };
    },
  });

  const companyName = companySettings?.companyName || 'Our Company';
  const appBaseUrl = companySettings?.appBaseUrl || window.location.origin;

  // Reset form when dialog opens with new data
  useEffect(() => {
    if (open && companyName) {
      setDidSyncPrimarySigner(false);
      setEmail(customerEmail || '');
      setSubject(
        isResend 
          ? `Reminder: Your Proposal from ${companyName}`
          : `Your Proposal from ${companyName}`
      );
      setMessage(
        isResend
          ? `Hi ${customerName},\n\nThis is a friendly reminder about your proposal. Please find it available for review through the link below.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\n${companyName}`
          : `Hi ${customerName},\n\nPlease find your proposal attached. You can review, comment, and sign it directly through the link below.\n\nIf you have any questions, please don't hesitate to reach out.\n\nBest regards,\n${companyName}`
      );
      setPortalLink(null);
      setCopied(false);
      setMultipleSigners(false);
      // Initialize with customer as first signer
      setSigners([{
        id: crypto.randomUUID(),
        name: customerName || '',
        email: customerEmail || '',
        order: 1,
        color: SIGNER_COLORS[0],
      }]);
    }
  }, [open, customerEmail, customerName, isResend, companyName]);

  // Fetch fresh estimate data from database (customer_email may have been updated)
  const { data: estimateData } = useQuery({
    queryKey: ['estimate-send-dialog', estimateId, open],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimates')
        .select('project_id, estimate_title, job_address, customer_phone, customer_email, customer_name, show_scope_to_customer, show_line_items_to_customer, show_details_to_customer, salesperson_name, salesperson_id, opportunity_uuid, opportunity_id')
        .eq('id', estimateId)
        .single();
      if (error) throw error;
      
      // If no salesperson on estimate, try to get from opportunity
      let salespersonName = data?.salesperson_name;
      if (!salespersonName && data?.opportunity_uuid) {
        const { data: oppData } = await supabase
          .from('opportunities')
          .select('salesperson_id, salespeople!opportunities_salesperson_id_fkey(name)')
          .eq('id', data.opportunity_uuid)
          .single();
        
        if (oppData?.salespeople?.name) {
          salespersonName = oppData.salespeople.name;
        }
      }
      
      return { ...data, salesperson_name: salespersonName };
    },
    enabled: open,
    staleTime: 0, // Always refetch when dialog opens
  });

  // Sync email from fresh database data when it loads
  useEffect(() => {
    if (estimateData?.customer_email && open) {
      setEmail(estimateData.customer_email);
      // Also update the first signer's email if in multi-signer mode
      if (signers.length > 0 && signers[0].email !== estimateData.customer_email) {
        setSigners(prev => prev.map((s, idx) => 
          idx === 0 ? { ...s, email: estimateData.customer_email || s.email } : s
        ));
      }
    }
  }, [estimateData?.customer_email, open]);

  // Check for existing signers (for resend)
  const { data: existingSigners } = useQuery({
    queryKey: ['estimate-signers', estimateId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('estimate_signers')
        .select('*')
        .eq('estimate_id', estimateId)
        .order('signer_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: open && isResend,
  });

  // Load existing signers for resend
  useEffect(() => {
    if (existingSigners && existingSigners.length > 0 && isResend) {
      setMultipleSigners(existingSigners.length > 1);
      setSigners(existingSigners.map((s, idx) => ({
        id: s.id,
        name: s.signer_name,
        email: s.signer_email,
        order: s.signer_order,
        color: SIGNER_COLORS[idx % SIGNER_COLORS.length],
      })));
    }
  }, [existingSigners, isResend]);

  // If we are in multiple-signer mode, ensure we are not showing the legacy single-signer project portal link.
  // Otherwise the email section never appears (it requires multi-signer tokens).
  useEffect(() => {
    if (!multipleSigners) return;
    if (!portalLink) return;
    if (portalLink === 'multi-signer') return;
    setPortalLink(null);
  }, [multipleSigners, portalLink]);

  // IMPORTANT: For resends, the email(s) actually used come from estimate_signers.
  // If the customer email was updated on the estimate, keep signer #1 in sync so resend goes to the new email.
  useEffect(() => {
    const freshEmail = estimateData?.customer_email;
    const freshName = estimateData?.customer_name;

    if (!open || !isResend) return;
    if (!freshEmail) return;
    if (!existingSigners || existingSigners.length === 0) return;
    if (didSyncPrimarySigner) return;

    const primary = existingSigners.find((s: any) => s.signer_order === 1);
    if (!primary) return;

    const needsEmailUpdate = primary.signer_email !== freshEmail;
    const needsNameUpdate = !!freshName && primary.signer_name !== freshName;
    if (!needsEmailUpdate && !needsNameUpdate) return;

    setDidSyncPrimarySigner(true);

    // Update local UI immediately
    setSigners((prev) =>
      prev.map((s) =>
        s.order === 1
          ? { ...s, email: freshEmail, name: freshName || s.name }
          : s
      )
    );

    // Update DB so actual resend recipients are correct
    void (async () => {
      const updatePayload: Record<string, string> = { signer_email: freshEmail };
      if (freshName) updatePayload.signer_name = freshName;

      const { error } = await supabase
        .from('estimate_signers')
        .update(updatePayload)
        .eq('estimate_id', estimateId)
        .eq('signer_order', 1);

      if (error) {
        console.error('Failed to sync primary signer email for resend:', error);
        // Allow retry if needed
        setDidSyncPrimarySigner(false);
        return;
      }

      queryClient.invalidateQueries({ queryKey: ['estimate-signers', estimateId] });
    })();
  }, [open, isResend, estimateData?.customer_email, estimateData?.customer_name, existingSigners, didSyncPrimarySigner, estimateId, queryClient]);

  // Check if there's an existing portal token for this project (single signer legacy)
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
    enabled: !!estimateData?.project_id && !multipleSigners,
  });

  // Sync visibility settings from estimateData
  useEffect(() => {
    if (estimateData) {
      setVisibilitySettings({
        show_scope_to_customer: estimateData.show_scope_to_customer ?? false,
        show_line_items_to_customer: estimateData.show_line_items_to_customer ?? false,
        show_details_to_customer: estimateData.show_details_to_customer ?? false,
      });
    }
  }, [estimateData]);

  // Auto-set portal link if existing token found (single signer mode)
  useEffect(() => {
    if (existingToken && !portalLink && !multipleSigners && appBaseUrl) {
      const link = `${appBaseUrl}/portal?token=${existingToken.token}`;
      setPortalLink(link);
    }
  }, [existingToken, portalLink, multipleSigners, appBaseUrl]);

  // Update visibility setting and save to DB
  const updateVisibilitySetting = async (key: keyof typeof visibilitySettings, value: boolean) => {
    setVisibilitySettings(prev => ({ ...prev, [key]: value }));
    
    // If hiding line items, also hide details
    if (key === 'show_line_items_to_customer' && !value) {
      setVisibilitySettings(prev => ({ ...prev, [key]: value, show_details_to_customer: false }));
      await supabase
        .from('estimates')
        .update({ [key]: value, show_details_to_customer: false })
        .eq('id', estimateId);
    } else {
      await supabase
        .from('estimates')
        .update({ [key]: value })
        .eq('id', estimateId);
    }
    
    queryClient.invalidateQueries({ queryKey: ['estimates'] });
    queryClient.invalidateQueries({ queryKey: ['estimate-preview', estimateId] });
    queryClient.invalidateQueries({ queryKey: ['portal-estimate-detail', estimateId] });
  };

  const generateLinkMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();
      
      // Get user's company_id for project creation
      let userCompanyId: string | null = null;
      if (user.user?.id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('id', user.user.id)
          .single();
        userCompanyId = profile?.company_id || null;
      }
      
      let projectId = estimateData?.project_id;
      
      // If no project exists, create one
      if (!projectId) {
        const nameParts = customerName.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';
        const jobAddr = estimateData?.job_address || jobAddress || null;
        const customerEmailToCheck = multipleSigners ? signers[0]?.email : (email || customerEmail || null);

        // Only match an existing project if BOTH email AND address match
        let existingProject = null;
        
        if (jobAddr && customerEmailToCheck) {
          const { data: projectByBoth } = await supabase
            .from('projects')
            .select('id, project_name, project_number')
            .eq('project_address', jobAddr)
            .eq('customer_email', customerEmailToCheck)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (projectByBoth) {
            existingProject = projectByBoth;
          }
        }

        if (existingProject) {
          projectId = existingProject.id;
          
          await supabase
            .from('estimates')
            .update({ project_id: projectId })
            .eq('id', estimateId);
        } else {
          const { data: maxProject } = await supabase
            .from('projects')
            .select('project_number')
            .order('project_number', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          const nextProjectNumber = (maxProject?.project_number || 0) + 1;

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
              company_id: userCompanyId,
              // Link project to opportunity from the estimate
              opportunity_id: estimateData?.opportunity_id || null,
              opportunity_uuid: estimateData?.opportunity_uuid || null,
              // Assign salesperson from estimate/opportunity
              primary_salesperson: estimateData?.salesperson_name || null,
            })
            .select()
            .single();

          if (projectError) throw projectError;
          projectId = newProject.id;

          await supabase
            .from('estimates')
            .update({ project_id: projectId })
            .eq('id', estimateId);
        }
      }

      if (multipleSigners) {
        // Multi-signer flow
        // First, delete any existing signers and tokens for this estimate
        await supabase
          .from('estimate_portal_tokens')
          .delete()
          .eq('estimate_id', estimateId);
        
        await supabase
          .from('estimate_signers')
          .delete()
          .eq('estimate_id', estimateId);

        // Create signers and tokens
        const signersToCreate = signers.filter(s => s.name && s.email);
        if (signersToCreate.length === 0) {
          throw new Error('At least one signer with name and email is required');
        }

        const createdSigners = [];
        for (const signer of signersToCreate) {
          const { data: signerData, error: signerError } = await supabase
            .from('estimate_signers')
            .insert({
              estimate_id: estimateId,
              signer_name: signer.name,
              signer_email: signer.email,
              signer_order: signer.order,
              status: 'pending',
            })
            .select()
            .single();

          if (signerError) throw signerError;

          // Create portal token for this signer
          const { data: tokenData, error: tokenError } = await supabase
            .from('estimate_portal_tokens')
            .insert({
              estimate_id: estimateId,
              signer_id: signerData.id,
            })
            .select()
            .single();

          if (tokenError) throw tokenError;

          createdSigners.push({
            ...signerData,
            token: tokenData.token,
          });
        }

        return { multiSigner: true, signers: createdSigners };
      } else {
        // Single signer flow (legacy - uses client_portal_tokens)
        const { data: existingProjectToken } = await supabase
          .from('client_portal_tokens')
          .select('*')
          .eq('project_id', projectId)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (existingProjectToken) {
          if (!existingProjectToken.estimate_id || existingProjectToken.estimate_id !== estimateId) {
            await supabase
              .from('client_portal_tokens')
              .update({ 
                estimate_id: estimateId,
                client_email: email || null,
              })
              .eq('id', existingProjectToken.id);
          }
          return { multiSigner: false, token: existingProjectToken };
        }

        const { data, error } = await supabase
          .from('client_portal_tokens')
          .insert({
            project_id: projectId,
            estimate_id: estimateId,
            client_email: email || null,
            client_name: customerName,
            created_by: user.user?.id,
            company_id: companyId,
          })
          .select()
          .single();

        if (error) throw error;
        return { multiSigner: false, token: data };
      }
    },
    onSuccess: (data) => {
      if (data.multiSigner) {
        toast.success(`Portal links generated for ${data.signers.length} signers!`);
        // For multi-signer, we don't set a single portal link
        setPortalLink('multi-signer');
      } else {
        const link = `${appBaseUrl}/portal?token=${data.token.token}`;
        setPortalLink(link);
        toast.success('Portal link generated!');
      }
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['estimate-signers', estimateId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      // Generate compliance documents before sending
      if (companyId) {
        try {
          const { data: complianceResult, error: complianceError } = await supabase.functions.invoke(
            'generate-compliance-documents',
            { body: { estimateId, companyId } }
          );
          if (complianceError) {
            console.error('Error generating compliance documents:', complianceError);
          } else if (complianceResult?.documents?.length > 0) {
            console.log(`Generated ${complianceResult.documents.length} compliance document(s)`);
          }
        } catch (err) {
          console.error('Failed to generate compliance documents:', err);
          // Don't fail the send for this - compliance docs are supplementary
        }
      }

      if (multipleSigners) {
        // Fetch created signers with tokens
        const { data: signersWithTokens, error: fetchError } = await supabase
          .from('estimate_signers')
          .select(`
            *,
            estimate_portal_tokens (token)
          `)
          .eq('estimate_id', estimateId)
          .order('signer_order', { ascending: true });

        if (fetchError) throw fetchError;
        if (!signersWithTokens || signersWithTokens.length === 0) {
          throw new Error('No signers found. Please generate links first.');
        }

        // Prepare batch email data - use company's configured base URL
        const recipients = signersWithTokens.map(signer => {
          const token = signer.estimate_portal_tokens?.[0]?.token;
          if (!token) throw new Error(`No token found for signer ${signer.signer_name}`);
          
          return {
            email: signer.signer_email,
            name: signer.signer_name,
            portalLink: `${appBaseUrl}/portal?estimate_token=${token}`,
          };
        });

        // Call edge function with batch mode
        const { error } = await supabase.functions.invoke('send-proposal-email', {
          body: {
            batch: true,
            recipients,
            subject,
            message,
            estimateId,
            companyId,
            isReminder: isResend,
            totalSigners: recipients.length,
            salespersonName: estimateData?.salesperson_name || undefined,
          },
        });

        if (error) throw error;

        // Update signer statuses to 'sent'
        await supabase
          .from('estimate_signers')
          .update({ 
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('estimate_id', estimateId);

      } else {
        // Single signer flow
        if (!email) throw new Error('Email is required');
        if (!portalLink) throw new Error('Generate a link first');

        const { error } = await supabase.functions.invoke('send-proposal-email', {
          body: {
            to: email,
            subject,
            message,
            portalLink,
            customerName,
            estimateId,
            companyId,
            isReminder: isResend,
            salespersonName: estimateData?.salesperson_name || undefined,
          },
        });

        if (error) throw error;
      }

      // Only update status if this is a first-time send (not a resend)
      if (!isResend) {
        await supabase
          .from('estimates')
          .update({
            status: 'sent',
            sent_at: new Date().toISOString(),
          })
          .eq('id', estimateId);
        
        // Update linked opportunity stage to "Proposal Sent"
        const opportunityGhlId = estimateData?.opportunity_id;
        if (opportunityGhlId) {
          try {
            await supabase.functions.invoke("update-ghl-opportunity", {
              body: {
                ghl_id: opportunityGhlId,
                stage_name: "Proposal Sent",
                company_id: companyId,
              },
            });
            console.log("Updated opportunity stage to 'Proposal Sent'");
          } catch (err) {
            console.error("Failed to update opportunity stage:", err);
            // Don't fail the send for this
          }
        }

        // Update project status to "Proposal" if linked
        if (estimateData?.project_id) {
          await supabase
            .from('projects')
            .update({ project_status: 'Proposal' })
            .eq('id', estimateData.project_id);
          console.log("Updated project status to 'Proposal'");
        }
      }
    },
    onSuccess: () => {
      const count = multipleSigners ? signers.filter(s => s.email).length : 1;
      toast.success(
        isResend 
          ? `Reminder sent to ${count} recipient(s)!` 
          : `Proposal sent to ${count} recipient(s)!`
      );
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
      queryClient.invalidateQueries({ queryKey: ['estimate-signers', estimateId] });
      queryClient.invalidateQueries({ queryKey: ['opportunities'] });

      // Auto-generate and save proposal PDF in the background
      (async () => {
        try {
          const { data: pdfResult, error: pdfError } = await supabase.functions.invoke('generate-contract-pdf', {
            body: { estimateId, projectId: estimateData?.project_id },
          });
          if (!pdfError && pdfResult?.url) {
            await supabase
              .from('estimates')
              .update({ proposal_pdf_url: pdfResult.url } as any)
              .eq('id', estimateId);
            console.log('Proposal PDF saved:', pdfResult.url);
            queryClient.invalidateQueries({ queryKey: ['estimates'] });
          } else {
            console.error('Failed to generate proposal PDF:', pdfError);
          }
        } catch (err) {
          console.error('Background PDF generation failed:', err);
        }
      })();

      // Call the external onSuccess callback if provided
      onSuccess?.();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const copyLink = async () => {
    if (!portalLink || portalLink === 'multi-signer') return;
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
    
    // Also update project status if linked
    if (estimateData?.project_id) {
      await supabase
        .from('projects')
        .update({ project_status: 'Proposal' })
        .eq('id', estimateData.project_id);
    }

    queryClient.invalidateQueries({ queryKey: ['estimates'] });
    toast.success('Proposal marked as sent');
    onOpenChange(false);
  };

  const canSendEmail = multipleSigners 
    ? portalLink === 'multi-signer' && signers.some(s => s.email)
    : portalLink && email;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg h-[85vh] flex flex-col overflow-hidden min-h-0 p-0">
        <DialogHeader className="flex-shrink-0 px-6 pt-6">
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

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-6 pb-6 pt-4 scrollbar-thin [@supports(-webkit-touch-callout:none)]:[-webkit-overflow-scrolling:touch]">
          <div className="space-y-4">
          {/* Single vs Multiple Signers Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              {multipleSigners ? (
                <Users className="h-4 w-4 text-muted-foreground" />
              ) : (
                <User className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-sm font-medium">
                {multipleSigners ? 'Multiple signers' : 'Single signer'}
              </span>
            </div>
            <Switch
              checked={multipleSigners}
              onCheckedChange={(checked) => {
                setMultipleSigners(checked);
                setPortalLink(null);
                if (checked && signers.length === 0) {
                  setSigners([{
                    id: crypto.randomUUID(),
                    name: customerName || '',
                    email: customerEmail || '',
                    order: 1,
                    color: SIGNER_COLORS[0],
                  }]);
                }
              }}
            />
          </div>

          {/* Signer Input Section */}
          {multipleSigners ? (
            <MultiSignerInput
              signers={signers}
              onChange={setSigners}
              maxSigners={6}
            />
          ) : (
            <div className="space-y-2">
              <Label>Client Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
          )}

          {/* Generate Link Button */}
          {!portalLink ? (
            <div className="space-y-2">
              <Button
                onClick={() => generateLinkMutation.mutate()}
                disabled={generateLinkMutation.isPending || (multipleSigners && !signers.some(s => s.name && s.email))}
                className="w-full"
              >
                {generateLinkMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Link className="h-4 w-4 mr-2" />
                )}
                {multipleSigners 
                  ? `Generate Links for ${signers.filter(s => s.name && s.email).length} Signer(s)`
                  : (estimateData?.project_id ? 'Get Portal Link' : 'Create Portal & Generate Link')
                }
              </Button>
              {multipleSigners && (
                <p className="text-xs text-muted-foreground text-center">
                  Click above to generate unique links for each signer and proceed to send your proposal
                </p>
              )}
            </div>
          ) : portalLink !== 'multi-signer' ? (
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
          ) : (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 text-green-800 text-sm">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                <span>Links generated for {signers.filter(s => s.email).length} signer(s)</span>
              </div>
              <p className="mt-1 text-xs text-green-600">
                Each signer will receive their own unique link to sign the proposal.
              </p>
              <p className="mt-2 text-xs text-muted-foreground border-t border-green-200 pt-2">
                <strong>Note:</strong> These are signing links only. All parties can access the shared project portal (photos, documents, invoices) using the main Customer Portal link after the project is created.
              </p>
            </div>
          )}

          {/* Email Section */}
          {canSendEmail && (
            <>
              {/* Visibility Settings */}
              <div className="border rounded-lg p-4 bg-muted/30">
                <div className="font-medium mb-3 flex items-center gap-2 text-sm">
                  <Eye className="h-4 w-4" />
                  Customer will see:
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {visibilitySettings.show_scope_to_customer ? (
                        <Eye className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-sm">Scope of Work Description</span>
                    </div>
                    <Switch
                      checked={visibilitySettings.show_scope_to_customer}
                      onCheckedChange={(checked) => updateVisibilitySetting('show_scope_to_customer', checked)}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {visibilitySettings.show_line_items_to_customer ? (
                        <Eye className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-sm">Line Items</span>
                    </div>
                    <Switch
                      checked={visibilitySettings.show_line_items_to_customer}
                      onCheckedChange={(checked) => updateVisibilitySetting('show_line_items_to_customer', checked)}
                    />
                  </div>
                  {visibilitySettings.show_line_items_to_customer && (
                    <div className="flex items-center justify-between pl-6">
                      <div className="flex items-center gap-2">
                        {visibilitySettings.show_details_to_customer ? (
                          <Eye className="h-3.5 w-3.5 text-green-600" />
                        ) : (
                          <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="text-sm">Line Item Details (Qty, Unit Price)</span>
                      </div>
                      <Switch
                        checked={visibilitySettings.show_details_to_customer}
                        onCheckedChange={(checked) => updateVisibilitySetting('show_details_to_customer', checked)}
                      />
                    </div>
                  )}
                </div>
              </div>

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
                      {multipleSigners 
                        ? 'Each signer will receive a personalized email with their unique portal link.'
                        : 'The portal link will be automatically included in the email.'}
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
                    {multipleSigners 
                      ? `Send to ${signers.filter(s => s.email).length} Recipient(s)`
                      : 'Send Email'}
                  </Button>
                </div>
              </div>
            </>
          )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
