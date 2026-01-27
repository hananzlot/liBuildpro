import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
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
import { Check, X, Loader2, UserCheck, MoreHorizontal, RefreshCw, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// Rep confirmation status options
export const REP_CONFIRMATION_OPTIONS = [
  { value: "unconfirmed", label: "Unconfirmed", icon: Clock, color: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
  { value: "confirmed", label: "Confirmed", icon: Check, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
  { value: "rescheduled", label: "Rescheduled", icon: RefreshCw, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
] as const;

export type RepConfirmationStatus = typeof REP_CONFIRMATION_OPTIONS[number]["value"];

interface CalendarAppointmentActionsProps {
  appointment: {
    id?: string;
    ghl_id?: string;
    contact_id?: string | null;
    location_id?: string;
    appointment_status?: string | null;
    salesperson_confirmed?: boolean;
    salesperson_confirmation_status?: string | null;
  };
  onUpdate?: () => void;
  compact?: boolean;
}

const STATUS_OPTIONS = [
  { value: "confirmed", label: "Confirmed", color: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200" },
  { value: "showed", label: "Showed", color: "bg-blue-100 text-blue-800 hover:bg-blue-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-red-100 text-red-800 hover:bg-red-200" },
  { value: "no_show", label: "No Show", color: "bg-amber-100 text-amber-800 hover:bg-amber-200" },
];

export function CalendarAppointmentActions({
  appointment,
  onUpdate,
  compact = false,
}: CalendarAppointmentActionsProps) {
  const { user } = useAuth();
  const { companyId } = useCompanyContext();
  const queryClient = useQueryClient();
  
  const [isUpdatingRep, setIsUpdatingRep] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [localRepStatus, setLocalRepStatus] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  // Get rep confirmation status - use new field first, fallback to legacy boolean
  const getRepConfirmationStatus = (): RepConfirmationStatus => {
    if (localRepStatus) return localRepStatus as RepConfirmationStatus;
    if (appointment.salesperson_confirmation_status) {
      return appointment.salesperson_confirmation_status as RepConfirmationStatus;
    }
    // Fallback to legacy boolean
    return appointment.salesperson_confirmed ? "confirmed" : "unconfirmed";
  };

  const repStatus = getRepConfirmationStatus();
  const currentStatus = localStatus ?? appointment.appointment_status;
  const repStatusOption = REP_CONFIRMATION_OPTIONS.find(o => o.value === repStatus) || REP_CONFIRMATION_OPTIONS[0];

  const handleRepStatusChange = async (newStatus: RepConfirmationStatus) => {
    const appointmentId = appointment?.id || appointment?.ghl_id;
    if (!appointmentId) return;

    setIsUpdatingRep(true);
    const oldValue = repStatus;
    try {
      let query = supabase
        .from("appointments")
        .update({
          salesperson_confirmation_status: newStatus,
          salesperson_confirmed: newStatus === "confirmed", // Keep legacy field in sync
          salesperson_confirmed_at: newStatus !== "unconfirmed" ? new Date().toISOString() : null,
          edited_by: user?.id || null,
          edited_at: new Date().toISOString(),
        });

      if (appointment?.id) {
        query = query.eq("id", appointment.id);
      } else if (appointment?.ghl_id) {
        query = query.eq("ghl_id", appointment.ghl_id);
      }

      const { error } = await query;
      if (error) throw error;

      // Record edit
      await supabase.from("appointment_edits").insert({
        appointment_ghl_id: appointment?.ghl_id || appointment?.id || "unknown",
        contact_ghl_id: appointment?.contact_id,
        field_name: "salesperson_confirmation_status",
        old_value: oldValue,
        new_value: newStatus,
        edited_by: user?.id || null,
        location_id: appointment?.location_id,
        company_id: companyId,
      });

      setLocalRepStatus(newStatus);
      await queryClient.invalidateQueries({ queryKey: ["appointments"], refetchType: "all" });
      toast.success(`Rep status: ${newStatus}`);
      onUpdate?.();
    } catch (error) {
      console.error("Error updating rep confirmation:", error);
      toast.error("Failed to update");
    } finally {
      setIsUpdatingRep(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    const appointmentId = appointment?.id || appointment?.ghl_id;
    if (!appointmentId) return;

    setIsUpdatingStatus(true);
    try {
      // Update via edge function (handles both GHL and local appointments)
      const { error: ghlError } = await supabase.functions.invoke("update-ghl-appointment", {
        body: { 
          ghl_id: appointment.ghl_id,
          appointmentUuid: appointment.id, // Internal UUID for local/Google appointments
          appointment_status: newStatus,
          location_id: appointment.location_id,
        },
      });
      
      if (ghlError) {
        console.warn("Edge function failed, updating directly:", ghlError);
        // Fallback: Update directly in Supabase
        let query = supabase
          .from("appointments")
          .update({
            appointment_status: newStatus,
            edited_by: user?.id || null,
            edited_at: new Date().toISOString(),
          });

        if (appointment?.id) {
          query = query.eq("id", appointment.id);
        } else if (appointment?.ghl_id) {
          query = query.eq("ghl_id", appointment.ghl_id);
        }

        const { error: dbError } = await query;
        if (dbError) throw dbError;
      }

      setLocalStatus(newStatus);
      await queryClient.invalidateQueries({ queryKey: ["appointments"], refetchType: "all" });
      toast.success(`Status: ${newStatus.replace("_", " ")}`);
      onUpdate?.();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Failed to update status");
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const normalizedStatus = currentStatus === "noshow" ? "no_show" : currentStatus;
  const currentStatusOption = STATUS_OPTIONS.find((s) => s.value === normalizedStatus);

  return (
    <div
      className="flex items-center gap-0.5"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Rep Confirmation Status Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={isUpdatingRep}
            className={`shrink-0 rounded-full flex items-center justify-center transition-colors ${
              compact ? "w-4 h-4" : "w-5 h-5"
            } ${
              repStatus === "confirmed"
                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                : repStatus === "rescheduled"
                ? "bg-blue-500 text-white hover:bg-blue-600"
                : "bg-amber-500 text-white hover:bg-amber-600"
            }`}
            title={`Rep: ${repStatusOption.label} - click to change`}
          >
            {isUpdatingRep ? (
              <Loader2 className={`animate-spin ${compact ? "h-2.5 w-2.5" : "h-3 w-3"}`} />
            ) : (
              <repStatusOption.icon className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[140px] bg-popover">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Rep Status</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {REP_CONFIRMATION_OPTIONS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => handleRepStatusChange(option.value)}
              className={`cursor-pointer gap-2 ${repStatus === option.value ? "bg-muted" : ""}`}
            >
              <option.icon className="h-3.5 w-3.5" />
              {option.label}
              {repStatus === option.value && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Appointment Status Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            disabled={isUpdatingStatus}
            className={`shrink-0 rounded flex items-center justify-center transition-colors ${
              compact ? "w-4 h-4" : "w-5 h-5"
            } ${
              currentStatusOption?.color || "bg-muted text-muted-foreground"
            } hover:opacity-80`}
            title={`Status: ${normalizedStatus?.replace("_", " ") || "New"} - click to change`}
          >
            {isUpdatingStatus ? (
              <Loader2 className={`animate-spin ${compact ? "h-2.5 w-2.5" : "h-3 w-3"}`} />
            ) : (
              <MoreHorizontal className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="min-w-[120px] bg-popover">
          {STATUS_OPTIONS.map((status) => (
            <DropdownMenuItem
              key={status.value}
              onClick={() => handleStatusChange(status.value)}
              className={`cursor-pointer ${normalizedStatus === status.value ? "bg-muted" : ""}`}
            >
              <span className={`mr-2 w-2 h-2 rounded-full ${status.color.split(" ")[0]}`} />
              {status.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
