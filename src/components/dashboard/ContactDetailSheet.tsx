import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Mail, Phone, Calendar, DollarSign, User, Tag, Clock, MapPin, Briefcase, FileText, MessageSquare, RefreshCw, Copy, ChevronDown, Pencil, Check, X, Trash2, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { findUserByIdOrGhlId } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";

const CUSTOM_FIELD_IDS = {
  ADDRESS: 'b7oTVsUQrLgZt84bHpCn',
  SCOPE_OF_WORK: 'KwQRtJT0aMSHnq3mwR68',
  NOTES: '588ddQgiGEg3AWtTQB2i',
};

const APPOINTMENT_STATUSES = [
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'showed', label: 'Showed' },
  { value: 'noshow', label: 'No Show' },
  { value: 'cancelled', label: 'Cancelled' },
];

interface Contact {
  id: string;
  ghl_id: string;
  contact_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  source?: string | null;
  tags?: string[] | null;
  ghl_date_added?: string | null;
  assigned_to?: string | null;
  attributions?: any;
  custom_fields?: unknown;
  company_id?: string | null;
}

interface Opportunity {
  id: string;
  ghl_id: string;
  name?: string | null;
  contact_id?: string | null;
  monetary_value?: number | null;
  status?: string | null;
  stage_name?: string | null;
  pipeline_name?: string | null;
  ghl_date_added?: string | null;
}

interface Appointment {
  id: string;
  ghl_id: string;
  title?: string | null;
  contact_id?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  appointment_status?: string | null;
  notes?: string | null;
  location_id?: string | null;
}

interface GHLUser {
  id: string;
  ghl_id: string;
  name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
}

interface Conversation {
  id: string;
  ghl_id: string;
  contact_id?: string | null;
  type?: string | null;
  last_message_body?: string | null;
  last_message_date?: string | null;
  last_message_type?: string | null;
  last_message_direction?: string | null;
  unread_count?: number | null;
}

interface ContactDetailSheetProps {
  contact: Contact | null;
  opportunities: Opportunity[];
  appointments: Appointment[];
  users: GHLUser[];
  conversations?: Conversation[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRefresh?: () => void;
}

const extractCustomField = (customFields: unknown, fieldId: string): string | null => {
  if (!customFields || !Array.isArray(customFields)) return null;
  const field = customFields.find((f: any) => f.id === fieldId);
  return field?.value || null;
};

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  count?: number;
  isOpen: boolean;
}

const SectionHeader = ({ icon, title, count, isOpen }: SectionHeaderProps) => (
  <div className="flex items-center justify-between w-full">
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}{count !== undefined ? ` (${count})` : ''}
      </span>
    </div>
    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
  </div>
);

// Editable field component
interface EditableFieldProps {
  icon: React.ReactNode;
  value: string | null | undefined;
  placeholder: string;
  onSave: (value: string) => Promise<void>;
  isAdmin: boolean;
  type?: 'text' | 'email' | 'tel';
  linkPrefix?: string;
  copyable?: boolean;
}

const EditableField = ({ icon, value, placeholder, onSave, isAdmin, type = 'text', linkPrefix, copyable }: EditableFieldProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEditValue(value || '');
  }, [value]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(editValue.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Save error:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2 w-full">
        {icon}
        <Input
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="h-7 text-sm flex-1"
          type={type}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') handleCancel();
          }}
        />
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleSave} disabled={isSaving}>
          {isSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3 text-emerald-500" />}
        </Button>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCancel} disabled={isSaving}>
          <X className="h-3 w-3 text-red-500" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 group">
      {icon}
      {value ? (
        <>
          {linkPrefix ? (
            <a href={`${linkPrefix}${value}`} className="text-primary hover:underline truncate">
              {value}
            </a>
          ) : (
            <span className="font-medium text-foreground">{value}</span>
          )}
          {copyable && (
            <button
              className="text-muted-foreground hover:text-primary p-0.5"
              onClick={() => {
                navigator.clipboard.writeText(value);
                toast({ title: "Copied" });
              }}
            >
              <Copy className="h-3 w-3" />
            </button>
          )}
        </>
      ) : (
        <span className="italic text-muted-foreground/60">{placeholder}</span>
      )}
      {isAdmin && (
        <button
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary p-0.5 transition-opacity"
          onClick={() => setIsEditing(true)}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
};

export function ContactDetailSheet({
  contact,
  opportunities,
  appointments,
  users,
  conversations = [],
  open,
  onOpenChange,
  onRefresh,
}: ContactDetailSheetProps) {
  const navigate = useNavigate();
  const { isAdmin, user, companyId } = useAuth();
  const [updatingAppointmentId, setUpdatingAppointmentId] = useState<string | null>(null);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ contact: true });
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingOpportunity, setIsCreatingOpportunity] = useState(false);
  const [localContact, setLocalContact] = useState<Contact | null>(null);

  // Sync local state with prop
  useEffect(() => {
    setLocalContact(contact);
  }, [contact]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  const handleUpdateAppointmentStatus = async (appointmentGhlId: string, newStatus: string, locationId?: string) => {
    setUpdatingAppointmentId(appointmentGhlId);
    try {
      const { error: ghlError } = await supabase.functions.invoke('update-ghl-appointment', {
        body: { ghl_id: appointmentGhlId, appointment_status: newStatus, location_id: locationId }
      });
      if (ghlError) throw ghlError;

      const { error: dbError } = await supabase
        .from('appointments')
        .update({ appointment_status: newStatus, ghl_date_updated: new Date().toISOString() })
        .eq('ghl_id', appointmentGhlId);
      if (dbError) throw dbError;

      toast({ title: "Status updated", description: `Appointment status changed to ${newStatus}` });
    } catch (error) {
      console.error('Error updating appointment status:', error);
      toast({ title: "Error", description: "Failed to update appointment status", variant: "destructive" });
    } finally {
      setUpdatingAppointmentId(null);
    }
  };

  const handleUpdateName = async (firstName: string, lastName: string) => {
    if (!localContact) return;
    try {
      const { error } = await supabase.functions.invoke('update-contact-name', {
        body: {
          contactId: localContact.ghl_id,
          contactUuid: localContact.id,
          firstName,
          lastName,
          editedBy: user?.id,
          companyId
        }
      });
      if (error) throw error;
      
      setLocalContact(prev => prev ? { 
        ...prev, 
        first_name: firstName, 
        last_name: lastName,
        contact_name: `${firstName} ${lastName}`.trim()
      } : null);
      toast({ title: "Name updated" });
      onRefresh?.();
    } catch (error) {
      console.error('Error updating name:', error);
      toast({ title: "Error", description: "Failed to update name", variant: "destructive" });
      throw error;
    }
  };

  const handleUpdatePhone = async (phone: string) => {
    if (!localContact) return;
    try {
      const { error } = await supabase.functions.invoke('update-contact-phone', {
        body: {
          contactId: localContact.ghl_id,
          contactUuid: localContact.id,
          phone,
          editedBy: user?.id,
          companyId
        }
      });
      if (error) throw error;
      
      setLocalContact(prev => prev ? { ...prev, phone } : null);
      toast({ title: "Phone updated" });
      onRefresh?.();
    } catch (error) {
      console.error('Error updating phone:', error);
      toast({ title: "Error", description: "Failed to update phone", variant: "destructive" });
      throw error;
    }
  };

  const handleUpdateEmail = async (email: string) => {
    if (!localContact) return;
    try {
      const { error } = await supabase.functions.invoke('update-contact-email', {
        body: {
          contactId: localContact.ghl_id,
          contactUuid: localContact.id,
          email,
          editedBy: user?.id,
          companyId
        }
      });
      if (error) throw error;
      
      setLocalContact(prev => prev ? { ...prev, email } : null);
      toast({ title: "Email updated" });
      onRefresh?.();
    } catch (error) {
      console.error('Error updating email:', error);
      toast({ title: "Error", description: "Failed to update email", variant: "destructive" });
      throw error;
    }
  };

  const handleUpdateAddress = async (address: string) => {
    if (!localContact) return;
    try {
      const { error } = await supabase.functions.invoke('update-contact-address', {
        body: {
          contactId: localContact.ghl_id,
          address,
          editedBy: user?.id,
          companyId
        }
      });
      if (error) throw error;
      toast({ title: "Address updated" });
      onRefresh?.();
    } catch (error) {
      console.error('Error updating address:', error);
      toast({ title: "Error", description: "Failed to update address", variant: "destructive" });
      throw error;
    }
  };

  const handleUpdateSource = async (source: string) => {
    if (!localContact) return;
    try {
      const { error } = await supabase.functions.invoke('update-contact-source', {
        body: {
          contactId: localContact.ghl_id,
          source,
          editedBy: user?.id,
          companyId
        }
      });
      if (error) throw error;
      
      setLocalContact(prev => prev ? { ...prev, source } : null);
      toast({ title: "Source updated" });
      onRefresh?.();
    } catch (error) {
      console.error('Error updating source:', error);
      toast({ title: "Error", description: "Failed to update source", variant: "destructive" });
      throw error;
    }
  };

  const handleDeleteContact = async () => {
    if (!localContact) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.functions.invoke('delete-ghl-contact', {
        body: {
          contactUuid: localContact.id,
          contactId: localContact.ghl_id,
          deleteFromGHL: true
        }
      });
      if (error) throw error;
      
      toast({ title: "Contact deleted", description: "The contact has been removed" });
      onOpenChange(false);
      navigate('/contacts', { replace: true });
      onRefresh?.();
    } catch (error) {
      console.error('Error deleting contact:', error);
      toast({ title: "Error", description: "Failed to delete contact", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateOpportunity = async () => {
    if (!localContact || !companyId) return;
    setIsCreatingOpportunity(true);
    try {
      // Get the location_id from company integrations
      const { data: integration } = await supabase
        .from('company_integrations')
        .select('location_id')
        .eq('company_id', companyId)
        .eq('provider', 'ghl')
        .eq('is_active', true)
        .maybeSingle();

      const locationId = integration?.location_id || `local_${companyId}`;
      const oppName = localContact.contact_name || 
        `${localContact.first_name || ''} ${localContact.last_name || ''}`.trim() || 
        'New Opportunity';

      // Create opportunity directly in Supabase (local-only)
      const { data: newOpp, error } = await supabase
        .from('opportunities')
        .insert({
          name: oppName,
          contact_id: localContact.ghl_id,
          contact_uuid: localContact.id,
          company_id: companyId,
          location_id: locationId,
          status: 'open',
          stage_name: 'New Lead',
          pipeline_name: 'Main',
          provider: 'local',
          ghl_date_added: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      toast({ title: "Opportunity created", description: `Created opportunity for ${oppName}` });
      onRefresh?.();
      
      // Navigate to the new opportunity
      if (newOpp?.id) {
        onOpenChange(false);
        navigate(`/opportunities/${newOpp.id}`);
      }
    } catch (error) {
      console.error('Error creating opportunity:', error);
      toast({ title: "Error", description: "Failed to create opportunity", variant: "destructive" });
    } finally {
      setIsCreatingOpportunity(false);
    }
  };

  if (!localContact) return null;

  const formatDateTime = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value == null) return "$0";
    return new Intl.NumberFormat("en-US", {
      style: "currency", currency: "USD", minimumFractionDigits: 0,
    }).format(value);
  };

  const getStatusColor = (status: string | null | undefined) => {
    switch (status?.toLowerCase()) {
      case "won":
      case "confirmed": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "lost":
      case "cancelled":
      case "no_show": return "bg-red-500/20 text-red-400 border-red-500/30";
      case "open":
      case "showed": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      default: return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    }
  };

  const contactName = localContact.contact_name || 
    `${localContact.first_name || ''} ${localContact.last_name || ''}`.trim() || 
    "Unknown Contact";

  const assignedUser = findUserByIdOrGhlId(users, undefined, localContact.assigned_to);
  const assignedUserName = assignedUser?.name || 
    `${assignedUser?.first_name || ''} ${assignedUser?.last_name || ''}`.trim() || 
    null;

  const relatedOpportunities = opportunities.filter(opp => opp.contact_id === localContact.ghl_id || opp.contact_id === localContact.id);
  const relatedAppointments = appointments.filter(apt => apt.contact_id === localContact.ghl_id || apt.contact_id === localContact.id);

  const address = extractCustomField(localContact.custom_fields, CUSTOM_FIELD_IDS.ADDRESS);
  const scopeFromCustomField = extractCustomField(localContact.custom_fields, CUSTOM_FIELD_IDS.SCOPE_OF_WORK);
  const scopeFromAttributions = (() => {
    if (!localContact?.attributions) return null;
    const attrs = localContact.attributions as Array<{ utmContent?: string }> | null;
    if (Array.isArray(attrs) && attrs.length > 0) {
      return attrs[0]?.utmContent || null;
    }
    return null;
  })();
  const scopeOfWork = scopeFromCustomField || scopeFromAttributions;
  const contactNotes = extractCustomField(localContact.custom_fields, CUSTOM_FIELD_IDS.NOTES);

  const totalValue = relatedOpportunities.reduce((sum, opp) => sum + (opp.monetary_value || 0), 0);

  const handleInteractOutside = (event: Event) => {
    if (document.visibilityState === 'hidden' || !document.hasFocus()) {
      event.preventDefault();
    }
  };

  const handleFocusOutside = (event: Event) => {
    if (document.visibilityState === 'hidden' || !document.hasFocus()) {
      event.preventDefault();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="sm:max-w-xl overflow-y-auto p-0"
        onInteractOutside={handleInteractOutside}
        onFocusOutside={handleFocusOutside}
      >
        {/* Header */}
        <div className="sticky top-0 bg-background border-b p-4 z-10">
          <SheetHeader className="space-y-1">
            <div className="flex items-start justify-between gap-3">
              <SheetTitle className="text-lg font-semibold leading-tight">
                {contactName}
              </SheetTitle>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-xs gap-1"
                  onClick={handleCreateOpportunity}
                  disabled={isCreatingOpportunity}
                >
                  {isCreatingOpportunity ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                  Create Opportunity
                </Button>
                {onRefresh && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRefresh}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                )}
                {isAdmin && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Contact</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                          <div className="space-y-3">
                            <p>Are you sure you want to delete "{contactName}"?</p>
                            
                            {relatedOpportunities.length > 0 && (
                              <div className="bg-destructive/10 border border-destructive/30 rounded-md p-3 text-destructive">
                                <p className="font-medium flex items-center gap-2">
                                  <Briefcase className="h-4 w-4" />
                                  Warning: {relatedOpportunities.length} opportunity{relatedOpportunities.length > 1 ? 'ies' : 'y'} will be deleted
                                </p>
                                <ul className="mt-2 text-sm space-y-1 ml-6 list-disc">
                                  {relatedOpportunities.slice(0, 5).map((opp) => (
                                    <li key={opp.id}>
                                      {opp.name || 'Unnamed'} 
                                      {opp.monetary_value ? ` (${formatCurrency(opp.monetary_value)})` : ''}
                                    </li>
                                  ))}
                                  {relatedOpportunities.length > 5 && (
                                    <li>...and {relatedOpportunities.length - 5} more</li>
                                  )}
                                </ul>
                              </div>
                            )}
                            
                            <p className="text-muted-foreground text-sm">
                              This will also unlink all related appointments and projects. This action cannot be undone.
                            </p>
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteContact}
                          disabled={isDeleting}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                          Delete{relatedOpportunities.length > 0 ? ` Contact & ${relatedOpportunities.length} Opportunit${relatedOpportunities.length > 1 ? 'ies' : 'y'}` : ''}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </div>
            {totalValue > 0 && (
              <div className="text-2xl font-bold text-emerald-400">
                {formatCurrency(totalValue)}
              </div>
            )}
          </SheetHeader>
        </div>

        <div className="p-4 space-y-3">
          {/* Key Info Grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Added</div>
              <div className="font-medium truncate">{formatDate(localContact.ghl_date_added)}</div>
            </div>
            <div className="bg-muted/40 rounded-md p-2.5">
              <div className="text-muted-foreground text-xs mb-0.5">Assigned To</div>
              <div className="font-medium truncate">{assignedUserName || 'Unassigned'}</div>
            </div>
          </div>

          {/* Contact Details - Collapsible with Opportunities inside */}
          <Collapsible open={openSections.contact} onOpenChange={() => toggleSection('contact')}>
            <div className="border rounded-lg overflow-hidden">
              <CollapsibleTrigger className="w-full bg-muted/30 px-3 py-2 border-b hover:bg-muted/50 transition-colors">
                <SectionHeader 
                  icon={<User className="h-3.5 w-3.5 text-muted-foreground" />} 
                  title="Contact Details" 
                  isOpen={openSections.contact || false}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-3 grid gap-2 text-sm text-muted-foreground">
                  {/* 1st: Contact Name (First + Last) */}
                  <EditableField
                    icon={<User className="h-3.5 w-3.5 shrink-0" />}
                    value={contactName}
                    placeholder="No name"
                    isAdmin={isAdmin}
                    onSave={async (value) => {
                      const parts = value.split(' ');
                      const firstName = parts[0] || '';
                      const lastName = parts.slice(1).join(' ') || '';
                      await handleUpdateName(firstName, lastName);
                    }}
                  />
                  
                  {/* 2nd: Address */}
                  <EditableField
                    icon={<MapPin className="h-3.5 w-3.5 shrink-0" />}
                    value={address}
                    placeholder="No address"
                    isAdmin={isAdmin}
                    onSave={handleUpdateAddress}
                  />
                  
                  {/* 3rd: Phone */}
                  <EditableField
                    icon={<Phone className="h-3.5 w-3.5 shrink-0" />}
                    value={localContact.phone}
                    placeholder="No phone"
                    isAdmin={true}
                    type="tel"
                    linkPrefix="tel:"
                    copyable
                    onSave={handleUpdatePhone}
                  />
                  
                  {/* 4th: Email */}
                  <EditableField
                    icon={<Mail className="h-3.5 w-3.5 shrink-0" />}
                    value={localContact.email}
                    placeholder="No email"
                    isAdmin={true}
                    type="email"
                    linkPrefix="mailto:"
                    copyable
                    onSave={handleUpdateEmail}
                  />
                  
                  {/* 5th: Source */}
                  <EditableField
                    icon={<Tag className="h-3.5 w-3.5 shrink-0" />}
                    value={localContact.source}
                    placeholder="No source"
                    isAdmin={isAdmin}
                    onSave={handleUpdateSource}
                  />
                </div>

                {/* Opportunities - Nested inside Contact Details */}
                {relatedOpportunities.length > 0 && (
                  <div className="border-t">
                    <div className="bg-muted/20 px-3 py-2 flex items-center gap-2">
                      <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Opportunities ({relatedOpportunities.length})
                      </span>
                    </div>
                    <div className="divide-y">
                      {relatedOpportunities.slice(0, 5).map((opp) => (
                        <div 
                          key={opp.id} 
                          className="p-3 flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/30 transition-colors"
                          onClick={() => navigate(`/opportunities/${opp.id}`)}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm truncate">{opp.name || "Unnamed"}</span>
                              <Badge variant="outline" className={`text-xs shrink-0 ${getStatusColor(opp.status)}`}>
                                {opp.status || "Unknown"}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {opp.pipeline_name || 'Pipeline'} → {opp.stage_name || 'Stage'}
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-emerald-400 shrink-0">
                            {formatCurrency(opp.monetary_value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Tags */}
          {localContact.tags && localContact.tags.length > 0 && (
            <Collapsible open={openSections.tags} onOpenChange={() => toggleSection('tags')}>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger className="w-full bg-muted/30 px-3 py-2 border-b hover:bg-muted/50 transition-colors">
                  <SectionHeader 
                    icon={<Tag className="h-3.5 w-3.5 text-muted-foreground" />} 
                    title="Tags" 
                    count={localContact.tags.length}
                    isOpen={openSections.tags || false}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3 flex flex-wrap gap-1.5">
                    {localContact.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Scope of Work */}
          {scopeOfWork && (
            <Collapsible open={openSections.scope} onOpenChange={() => toggleSection('scope')}>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger className="w-full bg-muted/30 px-3 py-2 border-b hover:bg-muted/50 transition-colors">
                  <SectionHeader 
                    icon={<Briefcase className="h-3.5 w-3.5 text-muted-foreground" />} 
                    title="Scope of Work" 
                    isOpen={openSections.scope || false}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3">
                    <p className="text-sm whitespace-pre-wrap">{scopeOfWork}</p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Notes */}
          {contactNotes && (
            <Collapsible open={openSections.notes} onOpenChange={() => toggleSection('notes')}>
              <div className="border rounded-lg overflow-hidden">
                <CollapsibleTrigger className="w-full bg-muted/30 px-3 py-2 border-b hover:bg-muted/50 transition-colors">
                  <SectionHeader 
                    icon={<FileText className="h-3.5 w-3.5 text-muted-foreground" />} 
                    title="Notes" 
                    isOpen={openSections.notes || false}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="p-3">
                    <p className="text-sm whitespace-pre-wrap">{contactNotes}</p>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          )}

          {/* Appointments */}
          <Collapsible open={openSections.appointments} onOpenChange={() => toggleSection('appointments')}>
            <div className="border rounded-lg overflow-hidden">
              <CollapsibleTrigger className="w-full bg-muted/30 px-3 py-2 border-b hover:bg-muted/50 transition-colors">
                <SectionHeader 
                  icon={<Clock className="h-3.5 w-3.5 text-muted-foreground" />} 
                  title="Appointments" 
                  count={relatedAppointments.length}
                  isOpen={openSections.appointments || false}
                />
              </CollapsibleTrigger>
              <CollapsibleContent>
                {relatedAppointments.length > 0 ? (
                  <div className="divide-y">
                    {relatedAppointments.slice(0, 5).map((apt) => (
                      <div key={apt.id} className="p-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium text-sm truncate">{apt.title || "Untitled"}</span>
                          <Select
                            value={apt.appointment_status || ''}
                            onValueChange={(value) => handleUpdateAppointmentStatus(apt.ghl_id, value, apt.location_id || undefined)}
                            disabled={updatingAppointmentId === apt.ghl_id}
                          >
                            <SelectTrigger className={`h-6 w-[100px] text-xs ${getStatusColor(apt.appointment_status)}`}>
                              <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                              {APPOINTMENT_STATUSES.map((status) => (
                                <SelectItem key={status.value} value={status.value} className="text-xs">
                                  {status.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDateTime(apt.start_time)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-3 text-sm text-muted-foreground/60 italic">No appointments</div>
                )}
              </CollapsibleContent>
            </div>
          </Collapsible>

          {/* Conversations / SMS */}
          {(() => {
            const relatedConversations = conversations.filter(c => c.contact_id === localContact.ghl_id || c.contact_id === localContact.id);
            return (
              <Collapsible open={openSections.conversations} onOpenChange={() => toggleSection('conversations')}>
                <div className="border rounded-lg overflow-hidden">
                  <CollapsibleTrigger className="w-full bg-muted/30 px-3 py-2 border-b hover:bg-muted/50 transition-colors">
                    <SectionHeader 
                      icon={<MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />} 
                      title="Conversations" 
                      count={relatedConversations.length}
                      isOpen={openSections.conversations || false}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {relatedConversations.length > 0 ? (
                      <div className="divide-y">
                        {relatedConversations.slice(0, 5).map((conv) => (
                          <div key={conv.id} className="p-3 space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">
                                  {conv.last_message_type || conv.type || 'Message'}
                                </Badge>
                                <Badge 
                                  variant="secondary" 
                                  className={`text-xs ${conv.last_message_direction === 'inbound' ? 'bg-blue-500/20 text-blue-400' : 'bg-emerald-500/20 text-emerald-400'}`}
                                >
                                  {conv.last_message_direction === 'inbound' ? '← In' : '→ Out'}
                                </Badge>
                              </div>
                              {(conv.unread_count ?? 0) > 0 && (
                                <Badge className="bg-red-500 text-white text-xs">
                                  {conv.unread_count} unread
                                </Badge>
                              )}
                            </div>
                            {conv.last_message_body && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {conv.last_message_body}
                              </p>
                            )}
                            <div className="text-xs text-muted-foreground/70">
                              {formatDateTime(conv.last_message_date)}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 text-sm text-muted-foreground/60 italic">No conversations</div>
                    )}
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })()}
        </div>
      </SheetContent>
    </Sheet>
  );
}
