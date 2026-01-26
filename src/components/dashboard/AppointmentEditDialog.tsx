import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, Loader2, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";

// Helper to get PST/PDT offset in hours
const getPSTOffset = (utcDate: Date): number => {
  const year = utcDate.getUTCFullYear();
  const marchSecondSunday = new Date(Date.UTC(year, 2, 8 + ((7 - new Date(Date.UTC(year, 2, 1)).getUTCDay()) % 7), 10));
  const novFirstSunday = new Date(Date.UTC(year, 10, 1 + ((7 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7), 9));
  const isDST = utcDate >= marchSecondSunday && utcDate < novFirstSunday;
  return isDST ? 7 : 8;
};

const APPOINTMENT_STATUSES = ["new", "confirmed", "cancelled", "no_show", "showed"] as const;

interface Appointment {
  id?: string;
  ghl_id: string;
  title: string | null;
  appointment_status: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  contact_id: string | null;
  assigned_user_id?: string | null;
  calendar_id?: string | null;
  address?: string | null;
  location_id?: string;
}

interface Salesperson {
  id: string;
  name: string | null;
  ghl_user_id: string | null;
}

interface AppointmentEditDialogProps {
  appointment: Appointment | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salespeople?: Salesperson[];
  contactId?: string | null;
  locationId?: string | null;
  onSuccess?: () => void;
  onDelete?: () => void;
  showRescheduleCheckbox?: boolean;
}

export function AppointmentEditDialog({
  appointment,
  open,
  onOpenChange,
  salespeople = [],
  contactId,
  locationId,
  onSuccess,
  onDelete,
  showRescheduleCheckbox = false,
}: AppointmentEditDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Form state
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");
  const [status, setStatus] = useState("");
  const [assignee, setAssignee] = useState("");
  const [notes, setNotes] = useState("");
  const [updateTime, setUpdateTime] = useState(false);

  // Original values for comparison
  const [originalDate, setOriginalDate] = useState("");
  const [originalTime, setOriginalTime] = useState("");

  // Loading states
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Sort salespeople alphabetically
  const sortedSalespeople = [...salespeople].sort((a, b) => 
    (a.name || "Unknown").localeCompare(b.name || "Unknown")
  );

  // Initialize form when appointment changes
  useEffect(() => {
    if (appointment && open) {
      setTitle(appointment.title || "");
      setAddress(appointment.address || "");
      setNotes(appointment.notes || "");
      setStatus(appointment.appointment_status === "noshow" ? "no_show" : (appointment.appointment_status || ""));
      
      // Find salesperson by ghl_user_id to get their internal ID for the dropdown
      const matchedSalesperson = salespeople.find(sp => sp.ghl_user_id === appointment.assigned_user_id);
      setAssignee(matchedSalesperson?.ghl_user_id || appointment.assigned_user_id || "__unassigned__");
      setUpdateTime(false);

      if (appointment.start_time) {
        const utcDate = new Date(appointment.start_time);
        const pstOffset = getPSTOffset(utcDate);
        const pstDate = new Date(utcDate.getTime() - pstOffset * 60 * 60 * 1000);
        const dateStr = pstDate.toISOString().split("T")[0];
        const timeStr = pstDate.toISOString().split("T")[1].substring(0, 5);
        setDate(dateStr);
        setTime(timeStr);
        setOriginalDate(dateStr);
        setOriginalTime(timeStr);
      } else {
        setDate("");
        setTime("09:00");
        setOriginalDate("");
        setOriginalTime("");
      }
    }
  }, [appointment, open, salespeople]);

  // Reset form on close
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setTitle("");
      setAddress("");
      setDate("");
      setTime("09:00");
      setStatus("");
      setAssignee("");
      setNotes("");
      setUpdateTime(false);
      setOriginalDate("");
      setOriginalTime("");
    }
    onOpenChange(newOpen);
  };

  const handleUpdate = async () => {
    if (!appointment || !date || !title.trim()) {
      toast.error("Please enter appointment title and date");
      return;
    }

    setIsUpdating(true);
    try {
      const assignedToValue = assignee && assignee !== "__unassigned__" ? assignee : null;

      const updateBody: Record<string, unknown> = {
        ghl_id: appointment.ghl_id,
        title: title.trim(),
        assignedUserId: assignedToValue,
        address: address.trim() || null,
        notes: notes.trim() || null,
        status: status || null,
      };

      // Determine if we should update time
      const shouldUpdateTime = showRescheduleCheckbox ? updateTime : true;
      const dateTimeChanged = date.trim() !== originalDate.trim() || time.trim() !== originalTime.trim();
      const normalizedStatus = (status || "").toLowerCase().trim();

      // Skip startTime if:
      // 1. User didn't ask for time update (showRescheduleCheckbox && !updateTime), OR
      // 2. Status is cancelled AND user didn't explicitly check reschedule (to avoid slot validation)
      // But if user explicitly checked "Reschedule", send time even if cancelled
      const isExplicitReschedule = showRescheduleCheckbox && updateTime;
      const skipDueToCancelled = normalizedStatus === "cancelled" && !isExplicitReschedule;
      const shouldSendStartTime = shouldUpdateTime && dateTimeChanged && !skipDueToCancelled;

      if (shouldSendStartTime) {
        const timeStr = time || "09:00";
        const pstOffset = getPSTOffset(new Date(`${date}T12:00:00Z`));
        const tempUtcDate = new Date(`${date}T${timeStr}:00.000Z`);
        const utcDate = new Date(tempUtcDate.getTime() + pstOffset * 60 * 60 * 1000);

        if (utcDate < new Date()) {
          toast.error("Cannot reschedule to a past date/time");
          setIsUpdating(false);
          return;
        }
        updateBody.startTime = utcDate.toISOString();
      }

      const response = await supabase.functions.invoke("update-ghl-appointment", {
        body: updateBody,
      });

      if (response.error) {
        console.error("Appointment update error:", response.error);
        const errorData = response.data as { error?: string } | null;
        const errorMsg = errorData?.error || "";
        if (errorMsg.includes("slot") || errorMsg.includes("available")) {
          toast.error(
            "This time slot is not available in GHL. Try a time on the hour/half-hour, or only update title/notes."
          );
        } else if (errorMsg) {
          toast.error(errorMsg);
        } else {
          toast.error("Failed to update appointment");
        }
        return;
      }

      // If notes changed and we have a contact, create a contact note
      const notesChanged = notes.trim() !== (appointment.notes || "").trim();
      const effectiveContactId = contactId || appointment.contact_id;
      if (notesChanged && notes.trim() && effectiveContactId) {
        try {
          const apptTitle = title.trim() || appointment.title || "Appointment";
          const noteBody = `[Appointment: ${apptTitle}]\n${notes.trim()}`;
          await supabase.functions.invoke("create-contact-note", {
            body: {
              contactId: effectiveContactId,
              body: noteBody,
              enteredBy: user?.id || null,
            },
          });
        } catch (noteError) {
          console.error("Error creating contact note for appointment:", noteError);
        }
      }

      toast.success("Appointment updated");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      handleOpenChange(false);
      onSuccess?.();
    } catch (err) {
      console.error("Error updating appointment:", err);
      toast.error("Failed to update appointment");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!appointment) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-ghl-appointment", {
        body: { appointmentId: appointment.ghl_id, appointmentUuid: appointment.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Appointment deleted");
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      handleOpenChange(false);
      onDelete?.();
    } catch (error) {
      console.error("Error deleting appointment:", error);
      toast.error("Failed to delete appointment");
    } finally {
      setIsDeleting(false);
    }
  };

  if (!appointment) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Edit Appointment
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4 overflow-y-auto flex-1 pr-2">
          <div className="space-y-2">
            <Label htmlFor="editApptTitle">Appointment Title</Label>
            <Input
              id="editApptTitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter appointment title..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="editApptAddress">Address</Label>
            <Input
              id="editApptAddress"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Enter appointment address..."
            />
          </div>

          <div className="space-y-2">
            <Label>Date & Time (PST)</Label>
            {showRescheduleCheckbox && (
              <div className="flex items-center space-x-2 mb-2">
                <Checkbox
                  id="updateTime"
                  checked={updateTime}
                  onCheckedChange={(checked) => setUpdateTime(checked === true)}
                />
<label htmlFor="updateTime" className="text-sm text-muted-foreground cursor-pointer">
  Reschedule appointment
</label>
              </div>
            )}
            <div className="flex gap-2">
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="flex-1"
                disabled={showRescheduleCheckbox && !updateTime}
              />
              <Input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-28"
                disabled={showRescheduleCheckbox && !updateTime}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {showRescheduleCheckbox && !updateTime
                ? "Check box above to change the appointment time"
                : "Times are in Pacific Standard Time (PST/PDT)"}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editApptStatus">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="editApptStatus">
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {APPOINTMENT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s === "no_show" ? "No Show" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editApptAssignee">Assign To</Label>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger>
                <SelectValue placeholder="Select salesperson..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__unassigned__">Unassigned</SelectItem>
                {sortedSalespeople.map((sp) => (
                  <SelectItem key={sp.id} value={sp.ghl_user_id || sp.id}>
                    {sp.name || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="editApptNotes">Notes (optional)</Label>
            <Textarea
              id="editApptNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add notes for this appointment..."
              rows={3}
            />
          </div>

          {/* Sync status indicator */}
          <div className="pt-2 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              {appointment.ghl_id?.startsWith("local_") 
                ? "✓ Saved locally"
                : "✓ Synced"}
            </p>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2 flex-shrink-0 pt-4 border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="outline"
                className="text-destructive hover:text-destructive border-destructive/30 hover:border-destructive/50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Appointment</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this appointment? This will also remove it from GoHighLevel. This
                  action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={isDeleting}
                >
                  {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <div className="flex gap-2 sm:ml-auto">
            <Button variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={isUpdating || !date}>
              {isUpdating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
