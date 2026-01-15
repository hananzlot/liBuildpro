import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ExternalLink, 
  Copy, 
  Check, 
  Loader2, 
  Link as LinkIcon,
  Eye,
  Calendar
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface CustomerPortalCardProps {
  projectId: string;
  customerName: string;
  customerEmail?: string | null;
}

export function CustomerPortalCard({ projectId, customerName, customerEmail }: CustomerPortalCardProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  // Check if portal token exists for this project
  const { data: portalToken, isLoading } = useQuery({
    queryKey: ['project-portal-token', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_portal_tokens')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_active', true)
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
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                <Check className="h-2.5 w-2.5 mr-1" />
                Portal Active
              </Badge>
              {portalToken.access_count > 0 && (
                <Badge variant="outline" className="text-[10px]">
                  <Eye className="h-2.5 w-2.5 mr-1" />
                  {portalToken.access_count} views
                </Badge>
              )}
            </div>
            
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
            </div>

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
    </Card>
  );
}
