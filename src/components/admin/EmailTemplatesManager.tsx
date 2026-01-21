import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Save, Eye, Loader2, Mail, FileText, CheckCircle, XCircle, Send } from "lucide-react";

interface EmailTemplate {
  id: string;
  key: string;
  name: string;
  subject: string;
  body: string;
  description: string;
  icon: React.ReactNode;
}

const DEFAULT_TEMPLATES: Record<string, { subject: string; body: string }> = {
  proposal_sent: {
    subject: "Your Proposal from {{company_name}}",
    body: `Dear {{customer_name}},

Thank you for the opportunity to provide you with a proposal for your project.

{{message}}

Please click the button below to review and sign your proposal online.

We look forward to working with you!

Best regards,
{{company_name}}`,
  },
  proposal_accepted: {
    subject: "🎉 Thank You for Choosing {{company_name}}!",
    body: `Dear {{customer_name}},

Congratulations and thank you for selecting {{company_name}} for your project!

We are absolutely thrilled and honored that you've chosen us. Our team is excited to bring your vision to life and deliver exceptional results.

**What happens next:**
1. Our project manager will contact you within 24-48 hours to schedule a kickoff meeting
2. We'll review all project details and timeline with you
3. You'll receive information about your dedicated project team

**Your Project Details:**
- Proposal: {{estimate_title}}
- Contract #: CNT-{{estimate_number}}
- Project Value: {{total}}

If you have any questions in the meantime, please don't hesitate to reach out.

Thank you again for your trust in us. We can't wait to get started!

Warmest regards,
The {{company_name}} Team`,
  },
  proposal_declined: {
    subject: "We received your response - {{company_name}}",
    body: `Dear {{customer_name}},

Thank you for taking the time to review our proposal for {{estimate_title}}.

We understand that this proposal wasn't the right fit for you at this time. We truly appreciate your consideration and the opportunity to provide you with a quote.

If there's anything we could do differently, or if you'd like to discuss alternative options, please don't hesitate to reach out. We're always here to help and would welcome the chance to work with you in the future.

Thank you again for considering {{company_name}}.

Best regards,
The {{company_name}} Team`,
  },
  admin_proposal_accepted: {
    subject: "🎉 Proposal Accepted: {{estimate_title}}",
    body: `Great news! {{customer_name}} has accepted and signed your proposal.

**Contract Details:**
- Customer: {{customer_name}}
- Proposal: {{estimate_title}}
- Contract #: CNT-{{estimate_number}}
- Amount: {{total}}
{{#job_address}}- Job Address: {{job_address}}{{/job_address}}

**Next Steps:**
- Review the signed contract in your CRM
- Schedule the project kickoff
- Send deposit invoice if applicable

This notification was sent by {{company_name}} CRM`,
  },
  admin_proposal_declined: {
    subject: "❌ Proposal Declined: {{estimate_title}}",
    body: `{{customer_name}} has declined your proposal.

**Proposal Details:**
- Customer: {{customer_name}}
- Proposal: {{estimate_title}}
- Estimate #: EST-{{estimate_number}}
- Amount: {{total}}

{{#decline_reason}}**Reason for Decline:**
{{decline_reason}}{{/decline_reason}}

**Suggested Actions:**
- Review the feedback and consider revisions
- Reach out to the customer to discuss alternatives
- Create a new estimate if needed

This notification was sent by {{company_name}} CRM`,
  },
  daily_portal_update: {
    subject: "Project Update Available - {{company_name}}",
    body: `Hello {{customer_name}},

There have been updates to your project in the last 24 hours.

**Project Details:**
- Project #: {{project_number}}
- Address: {{project_address}}

Please visit your customer portal to view the latest information, documents, invoices, and photos.

Click the button in the email to access your portal directly.

If you have any questions, please don't hesitate to contact us.

Best regards,
The {{company_name}} Team`,
  },
};

const TEMPLATE_META: Record<string, { name: string; description: string; icon: React.ReactNode }> = {
  proposal_sent: {
    name: "Proposal Sent to Customer",
    description: "Email sent to customers when you send them a proposal",
    icon: <Send className="h-5 w-5 text-blue-500" />,
  },
  proposal_accepted: {
    name: "Customer Acceptance Confirmation",
    description: "Email sent to customers when they accept and sign a proposal",
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
  },
  proposal_declined: {
    name: "Customer Decline Acknowledgment",
    description: "Email sent to customers when they decline a proposal",
    icon: <XCircle className="h-5 w-5 text-red-500" />,
  },
  admin_proposal_accepted: {
    name: "Admin: Proposal Accepted Notification",
    description: "Email sent to your team when a customer accepts a proposal",
    icon: <CheckCircle className="h-5 w-5 text-green-500" />,
  },
  admin_proposal_declined: {
    name: "Admin: Proposal Declined Notification",
    description: "Email sent to your team when a customer declines a proposal",
    icon: <XCircle className="h-5 w-5 text-red-500" />,
  },
  daily_portal_update: {
    name: "Daily Portal Update Email",
    description: "Automated/manual email sent to customers when their project has updates",
    icon: <Mail className="h-5 w-5 text-primary" />,
  },
};

export function EmailTemplatesManager() {
  const queryClient = useQueryClient();
  const { companyId } = useCompanyContext();
  const [editedTemplates, setEditedTemplates] = useState<Record<string, { subject: string; body: string }>>({});
  const [previewTemplate, setPreviewTemplate] = useState<string | null>(null);

  // Fetch email templates from company_settings (with app_settings fallback)
  const { data: settings, isLoading } = useQuery({
    queryKey: ["email-templates", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      
      // First try company_settings
      const { data: companyData } = await supabase
        .from("company_settings")
        .select("*")
        .eq("company_id", companyId)
        .like("setting_key", "email_template_%");

      // Fall back to app_settings for templates not in company_settings
      const { data: appData, error } = await supabase
        .from("app_settings")
        .select("*")
        .like("setting_key", "email_template_%");

      if (error) throw error;
      
      // Merge: company_settings override app_settings
      const companyMap = new Map((companyData || []).map(s => [s.setting_key, s]));
      const merged = (appData || []).map(appSetting => {
        const companySetting = companyMap.get(appSetting.setting_key);
        if (companySetting) {
          companyMap.delete(appSetting.setting_key);
          return companySetting;
        }
        return appSetting;
      });
      
      // Add remaining company-specific templates
      companyMap.forEach(s => merged.push(s));
      
      return merged;
    },
    enabled: !!companyId,
  });

  // Fetch company name for preview
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings-name", companyId],
    queryFn: async () => {
      if (!companyId) return {};
      
      const { data } = await supabase
        .from("company_settings")
        .select("setting_key, setting_value")
        .eq("company_id", companyId)
        .in("setting_key", ["company_name"]);
      
      if (data && data.length > 0) {
        return data.reduce((acc, s) => ({ ...acc, [s.setting_key]: s.setting_value }), {}) as Record<string, string>;
      }
      
      // Fallback to app_settings
      const { data: appData } = await supabase
        .from("app_settings")
        .select("setting_key, setting_value")
        .in("setting_key", ["company_name"]);
      return appData?.reduce((acc, s) => ({ ...acc, [s.setting_key]: s.setting_value }), {}) as Record<string, string>;
    },
    enabled: !!companyId,
  });

  const saveMutation = useMutation({
    mutationFn: async ({ key, subject, body }: { key: string; subject: string; body: string }) => {
      if (!companyId) throw new Error("No company selected");
      
      const value = JSON.stringify({ subject, body });
      
      // Upsert the template to company_settings
      const { error } = await supabase
        .from("company_settings")
        .upsert({
          company_id: companyId,
          setting_key: `email_template_${key}`,
          setting_value: value,
          setting_type: "json",
          description: TEMPLATE_META[key]?.description || "Email template",
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "company_id,setting_key",
        });

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["email-templates", companyId] });
      toast.success("Template saved successfully");
      setEditedTemplates((prev) => {
        const newState = { ...prev };
        delete newState[variables.key];
        return newState;
      });
    },
    onError: (error: Error) => {
      toast.error(`Failed to save template: ${error.message}`);
    },
  });

  const getTemplate = (key: string): { subject: string; body: string } => {
    // Check edited first
    if (editedTemplates[key]) {
      return editedTemplates[key];
    }
    
    // Check saved settings
    const setting = settings?.find((s) => s.setting_key === `email_template_${key}`);
    if (setting?.setting_value) {
      try {
        return JSON.parse(setting.setting_value);
      } catch {
        return DEFAULT_TEMPLATES[key];
      }
    }
    
    // Return default
    return DEFAULT_TEMPLATES[key];
  };

  const hasChanges = (key: string) => {
    return !!editedTemplates[key];
  };

  const handleChange = (key: string, field: "subject" | "body", value: string) => {
    const current = getTemplate(key);
    setEditedTemplates((prev) => ({
      ...prev,
      [key]: {
        ...current,
        [field]: value,
      },
    }));
  };

  const handleSave = (key: string) => {
    const template = getTemplate(key);
    saveMutation.mutate({ key, ...template });
  };

  const handleReset = (key: string) => {
    setEditedTemplates((prev) => {
      const newState = { ...prev };
      delete newState[key];
      return newState;
    });
  };

  const renderPreview = (key: string) => {
    const template = getTemplate(key);
    const companyName = companySettings?.company_name || "Your Company";
    
    // Sample data for preview
    const sampleData: Record<string, string> = {
      customer_name: "John Smith",
      company_name: companyName,
      estimate_title: "Kitchen Remodel - Modern Design",
      estimate_number: "2001",
      total: "$45,000",
      job_address: "123 Main Street, Los Angeles, CA 90001",
      message: "We're pleased to present this proposal for your kitchen remodel project. This includes all materials, labor, and a 2-year warranty.",
      decline_reason: "The timeline doesn't work for us at this time.",
      project_number: "2024-0125",
      project_address: "123 Main Street, Los Angeles, CA 90001",
    };

    // Replace template variables
    let subject = template.subject;
    let body = template.body;
    
    Object.entries(sampleData).forEach(([key, value]) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      subject = subject.replace(regex, value);
      body = body.replace(regex, value);
    });
    
    // Handle conditional blocks (simple implementation)
    body = body.replace(/{{#(\w+)}}([\s\S]*?){{\/\1}}/g, (match, key, content) => {
      return sampleData[key] ? content.replace(new RegExp(`{{${key}}}`, "g"), sampleData[key]) : "";
    });

    return (
      <div className="space-y-4">
        <div>
          <Label className="text-muted-foreground text-xs">Subject</Label>
          <p className="font-semibold text-lg">{subject}</p>
        </div>
        <Separator />
        <div className="prose prose-sm max-w-none">
          <div 
            className="whitespace-pre-wrap text-sm leading-relaxed"
            dangerouslySetInnerHTML={{ 
              __html: body
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                .replace(/\n/g, '<br />') 
            }}
          />
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const templateKeys = Object.keys(DEFAULT_TEMPLATES);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Templates
          </CardTitle>
          <CardDescription>
            Customize the emails sent to customers and your team. Use template variables like{" "}
            <code className="bg-muted px-1 rounded">{"{{customer_name}}"}</code> to personalize messages.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-muted-foreground mb-4">
            <p><strong>Available variables:</strong></p>
            <div className="flex flex-wrap gap-2">
              {["customer_name", "company_name", "estimate_title", "estimate_number", "total", "job_address", "message", "decline_reason", "project_number", "project_address"].map((v) => (
                <code key={v} className="bg-muted px-2 py-0.5 rounded text-xs">{`{{${v}}}`}</code>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {templateKeys.map((key) => {
        const meta = TEMPLATE_META[key];
        const template = getTemplate(key);
        const changed = hasChanges(key);

        return (
          <Card key={key}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {meta.icon}
                  <div>
                    <CardTitle className="text-base">{meta.name}</CardTitle>
                    <CardDescription className="text-xs">{meta.description}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPreviewTemplate(key)}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  {changed && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleReset(key)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSave(key)}
                        disabled={saveMutation.isPending}
                      >
                        {saveMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4 mr-1" />
                        )}
                        Save
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor={`${key}-subject`}>Subject Line</Label>
                <Input
                  id={`${key}-subject`}
                  value={template.subject}
                  onChange={(e) => handleChange(key, "subject", e.target.value)}
                  placeholder="Email subject..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${key}-body`}>Email Body</Label>
                <Textarea
                  id={`${key}-body`}
                  value={template.body}
                  onChange={(e) => handleChange(key, "body", e.target.value)}
                  placeholder="Email content..."
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Email Preview
            </DialogTitle>
            <DialogDescription>
              This is how the email will look with sample data
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="bg-white border rounded-lg p-6">
              {previewTemplate && renderPreview(previewTemplate)}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}