import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
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
import { Check, X, Loader2, UserCheck, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface CalendarAppointmentActionsProps {
  appointment: {
    id?: string;
    ghl_id?: string;
    contact_id?: string | null;
    location_id?: string;
    appointment_status?: string | null;
    salesperson_confirmed?: boolean;
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
  const [showRepConfirmDialog, setShowRepConfirmDialog] = useState(false);
  const [localRepConfirmed, setLocalRepConfirmed] = useState<boolean | null>(null);
  const [localStatus, setLocalStatus] = useState<string | null>(null);

  const isRepConfirmed = localRepConfirmed ?? appointment.salesperson_confirmed;
  const currentStatus = localStatus ?? appointment.appointment_status;

  const handleRepConfirmClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRepConfirmDialog(true);
  };

  const handleConfirmRepToggle = async () => {
    const appointmentId = appointment?.id || appointment?.ghl_id;
    if (!appointmentId) return;

    setIsUpdatingRep(true);
    const oldValue = isRepConfirmed;
    try {
      const newValue = !isRepConfirmed;

      let query = supabase
        .from("appointments")
        .update({
          salesperson_confirmed: newValue,
          salesperson_confirmed_at: newValue ? new Date().toISOString() : null,
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
        field_name: "salesperson_confirmed",
        old_value: String(oldValue),
        new_value: String(newValue),
        edited_by: user?.id || null,
        location_id: appointment?.location_id,
        company_id: companyId,
      });

      setLocalRepConfirmed(newValue);
      await queryClient.invalidateQueries({ queryKey: ["appointments"], refetchType: "all" });
      toast.success(newValue ? "Rep confirmed" : "Confirmation removed");
      onUpdate?.();
    } catch (error) {
      console.error("Error updating rep confirmation:", error);
      toast.error("Failed to update");
    } finally {
      setIsUpdatingRep(false);
      setShowRepConfirmDialog(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    const appointmentId = appointment?.id || appointment?.ghl_id;
    if (!appointmentId) return;

    setIsUpdatingStatus(true);
    try {
      // If it's a GHL appointment, update GHL first
      if (appointment?.ghl_id) {
        const { error: ghlError } = await supabase.functions.invoke("update-ghl-appointment", {
          body: { ghl_id: appointment.ghl_id, appointment_status: newStatus },
        });
        if (ghlError) {
          console.warn("GHL update failed, updating local only:", ghlError);
        }
      }

      // Update in Supabase
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
    <>
      <div
        className="flex items-center gap-0.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Rep Confirm Badge */}
        <button
          onClick={handleRepConfirmClick}
          disabled={isUpdatingRep}
          className={`shrink-0 rounded-full flex items-center justify-center transition-colors ${
            compact ? "w-4 h-4" : "w-5 h-5"
          } ${
            isRepConfirmed
              ? "bg-emerald-500 text-white hover:bg-emerald-600"
              : "bg-amber-500 text-white hover:bg-amber-600"
          }`}
          title={isRepConfirmed ? "Rep confirmed - click to remove" : "Rep not confirmed - click to confirm"}
        >
          {isUpdatingRep ? (
            <Loader2 className={`animate-spin ${compact ? "h-2.5 w-2.5" : "h-3 w-3"}`} />
          ) : isRepConfirmed ? (
            <Check className={compact ? "h-2.5 w-2.5" : "h-3 w-3"} />
          ) : (
            <span className={`font-bold ${compact ? "text-[7px]" : "text-[8px]"}`}>!</span>
          )}
        </button>

        {/* Status Dropdown */}
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
          <DropdownMenuContent align="start" className="min-w-[120px]">
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

      {/* Rep Confirm Dialog */}
      <AlertDialog open={showRepConfirmDialog} onOpenChange={setShowRepConfirmDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              {isRepConfirmed ? "Remove Rep Confirmation?" : "Confirm Rep?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isRepConfirmed
                ? "This will remove the sales rep confirmation for this appointment."
                : "This will mark this appointment as confirmed by the sales rep."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdatingRep}>No</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmRepToggle} disabled={isUpdatingRep}>
              {isUpdatingRep ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                "Yes"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
