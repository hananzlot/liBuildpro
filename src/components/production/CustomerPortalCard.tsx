import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCompanyContext } from '@/hooks/useCompanyContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { 
  ExternalLink, 
  Copy, 
  Check, 
  Loader2, 
  Link as LinkIcon,
  Eye,
  Calendar,
  RefreshCw,
  Mail,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface CustomerPortalCardProps {
  projectId: string;
  customerName: string;
  customerEmail?: string | null;
}

export function CustomerPortalCard({ projectId, customerName, customerEmail }: CustomerPortalCardProps) {
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showRefreshWarning, setShowRefreshWarning] = useState(false);

  // Fetch company name for display (try company_settings first)
  const { data: companyName } = useQuery({
    queryKey: ['company-name', companyId],
    queryFn: async () => {
      // Try company_settings first if we have companyId
      if (companyId) {
        const { data: companyData } = await supabase
          .from('company_settings')
          .select('setting_value')
          .eq('company_id', companyId)
          .eq('setting_key', 'company_name')
          .single();
        if (companyData?.setting_value) return companyData.setting_value;
      }
      // Fall back to app_settings
      const { data, error } = await supabase
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'company_name')
        .single();
      if (error) throw error;
      return data?.setting_value || 'Company';
    },
    staleTime: 1000 * 60 * 5,
  });

  // Check if portal token exists for this project (including inactive ones)
  const { data: portalToken, isLoading } = useQuery({
    queryKey: ['project-portal-token', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_portal_tokens')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
      return data;
    },
  });

  const portalLink = portalToken 
    ? `${window.location.origin}/portal?token=${portalToken.token}`
    : null;

  const createPortalMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();

      const { data, error } = await supabase
        .from('client_portal_tokens')
        .insert({
          project_id: projectId,
          client_name: customerName,
          client_email: customerEmail || null,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Customer portal created!');
      queryClient.invalidateQueries({ queryKey: ['project-portal-token', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const recreatePortalMutation = useMutation({
    mutationFn: async () => {
      const { data: user } = await supabase.auth.getUser();

      // Deactivate existing tokens for this project
      await supabase
        .from('client_portal_tokens')
        .update({ is_active: false })
        .eq('project_id', projectId);

      // Create new token
      const { data, error } = await supabase
        .from('client_portal_tokens')
        .insert({
          project_id: projectId,
          client_name: customerName,
          client_email: customerEmail || null,
          created_by: user.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Portal link regenerated!');
      queryClient.invalidateQueries({ queryKey: ['project-portal-token', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (isActive: boolean) => {
      const { error } = await supabase
        .from('client_portal_tokens')
        .update({ is_active: isActive })
        .eq('id', portalToken?.id);
      if (error) throw error;
    },
    onSuccess: (_, isActive) => {
      toast.success(isActive ? 'Portal activated' : 'Portal deactivated');
      queryClient.invalidateQueries({ queryKey: ['project-portal-token', projectId] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('send-portal-update-email', {
        body: { projectId }
      });
      if (error) throw error;
      if (!data.success) throw new Error(data.error || 'Failed to send email');
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Email sent to customer!');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const copyLink = async () => {
    if (!portalLink) return;
    await navigator.clipboard.writeText(portalLink);
    setCopied(true);
    toast.success('Portal link copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const openPortal = () => {
    if (portalLink) {
      window.open(portalLink, '_blank');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-medium flex items-center gap-2">
            <LinkIcon className="h-3 w-3" />
            Customer Portal
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-xs font-medium flex items-center gap-2">
          <LinkIcon className="h-3 w-3" />
          Customer Portal
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {portalToken ? (
          <>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant={portalToken.is_active ? "secondary" : "outline"} className="text-[10px]">
                  {portalToken.is_active ? (
                    <><Check className="h-2.5 w-2.5 mr-1" />Active</>
                  ) : (
                    'Inactive'
                  )}
                </Badge>
                {portalToken.access_count > 0 && (
                  <Badge variant="outline" className="text-[10px]">
                    <Eye className="h-2.5 w-2.5 mr-1" />
                    {portalToken.access_count} views
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label htmlFor="portal-active" className="text-[10px] text-muted-foreground">
                  {portalToken.is_active ? 'On' : 'Off'}
                </Label>
                <Switch
                  id="portal-active"
                  checked={portalToken.is_active}
                  onCheckedChange={(checked) => toggleActiveMutation.mutate(checked)}
                  disabled={toggleActiveMutation.isPending}
                  className="scale-75"
                />
              </div>
            </div>
            
            {portalToken.is_active && (
              <>
                <div className="flex gap-2">
                  <Input 
                    value={portalLink || ''} 
                    readOnly 
                    className="h-7 text-[10px] font-mono"
                  />
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 px-2"
                    onClick={copyLink}
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1 h-7 text-xs"
                    onClick={openPortal}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Open Portal
                  </Button>
                  <Button 
                    variant="default" 
                    size="sm" 
                    className="flex-1 h-7 text-xs"
                    onClick={() => sendEmailMutation.mutate()}
                    disabled={sendEmailMutation.isPending || !customerEmail}
                    title={customerEmail ? 'Send portal update email to customer' : 'No customer email available'}
                  >
                    {sendEmailMutation.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Mail className="h-3 w-3 mr-1" />
                    )}
                    Email Customer
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setShowRefreshWarning(true)}
                    disabled={recreatePortalMutation.isPending}
                    title="Regenerate portal link"
                  >
                    {recreatePortalMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                {!customerEmail && (
                  <p className="text-[10px] text-amber-600">
                    ⚠️ No customer email on file. Add email to send notifications.
                  </p>
                )}
              </>
            )}

            {portalToken.last_accessed_at && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Last accessed: {format(new Date(portalToken.last_accessed_at), 'MMM d, yyyy h:mm a')}
              </p>
            )}
          </>
        ) : (
          <div className="text-center py-2">
            <p className="text-xs text-muted-foreground mb-3">
              Create a portal for your customer to view project updates, invoices, and photos.
            </p>
            <Button
              size="sm"
              className="h-7 text-xs"
              onClick={() => createPortalMutation.mutate()}
              disabled={createPortalMutation.isPending}
            >
              {createPortalMutation.isPending ? (
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              ) : (
                <LinkIcon className="h-3 w-3 mr-1" />
              )}
              Create Customer Portal
            </Button>
          </div>
        )}
      </CardContent>

      {/* Refresh Link Warning Dialog */}
      <AlertDialog open={showRefreshWarning} onOpenChange={setShowRefreshWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Regenerate Portal Link?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                <strong>Warning:</strong> This will deactivate the current portal link. The customer will no longer be able to access their portal using the existing link.
              </p>
              <p>
                You will need to notify the customer of the new link before they can regain access to their {companyName || 'company'} portal.
              </p>
              <p className="text-amber-600 font-medium">
                Make sure to send the new link to the customer after regenerating.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                recreatePortalMutation.mutate();
                setShowRefreshWarning(false);
              }}
              className="bg-amber-600 hover:bg-amber-700"
            >
              Regenerate Link
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
