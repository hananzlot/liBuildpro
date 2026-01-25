import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, FileText, MapPin, User, Phone, Mail, Ruler, AlertCircle, CheckCircle } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ScopePricingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  salespersonId: string;
  // Pre-fill from appointment context
  appointmentId?: string;
  opportunityId?: string;
  contactId?: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  jobAddress?: string;
  existingScope?: string;
}

type Priority = "low" | "normal" | "high" | "urgent";

const PROJECT_TYPES = [
  "Kitchen Remodel",
  "Bathroom Remodel",
  "Roofing",
  "Windows & Doors",
  "Siding",
  "HVAC",
  "Flooring",
  "Painting",
  "Deck/Patio",
  "Whole Home Remodel",
  "Addition",
  "Electrical",
  "Plumbing",
  "Other",
];

export function ScopePricingDialog({
  open,
  onOpenChange,
  companyId,
  salespersonId,
  appointmentId,
  opportunityId,
  contactId,
  customerName = "",
  customerPhone = "",
  customerEmail = "",
  jobAddress = "",
  existingScope = "",
}: ScopePricingDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  
  const [formData, setFormData] = useState({
    customer_name: customerName,
    customer_phone: customerPhone,
    customer_email: customerEmail,
    job_address: jobAddress,
    project_type: "",
    scope_description: existingScope,
    measurements: "",
    special_requirements: "",
    priority: "normal" as Priority,
  });

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_name.trim()) {
      toast.error("Customer name is required");
      return;
    }
    if (!formData.scope_description.trim()) {
      toast.error("Scope description is required");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from("scope_submissions")
        .insert({
          company_id: companyId,
          salesperson_id: salespersonId,
          appointment_id: appointmentId || null,
          opportunity_id: opportunityId || null,
          contact_id: contactId || null,
          customer_name: formData.customer_name.trim(),
          customer_phone: formData.customer_phone.trim() || null,
          customer_email: formData.customer_email.trim() || null,
          job_address: formData.job_address.trim() || null,
          project_type: formData.project_type || null,
          scope_description: formData.scope_description.trim(),
          measurements: formData.measurements.trim() || null,
          special_requirements: formData.special_requirements.trim() || null,
          priority: formData.priority,
          status: "pending",
        });

      if (error) throw error;

      setIsSubmitted(true);
      toast.success("Scope submitted successfully!");
      
      // Close after a moment to show success state
      setTimeout(() => {
        onOpenChange(false);
        setIsSubmitted(false);
        // Reset form
        setFormData({
          customer_name: "",
          customer_phone: "",
          customer_email: "",
          job_address: "",
          project_type: "",
          scope_description: "",
          measurements: "",
          special_requirements: "",
          priority: "normal",
        });
      }, 2000);

    } catch (error) {
      console.error("Error submitting scope:", error);
      toast.error("Failed to submit scope. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-foreground mb-2">
              Scope Submitted!
            </h3>
            <p className="text-muted-foreground">
              The office will review your scope and prepare pricing shortly.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Request Pricing
          </DialogTitle>
          <DialogDescription>
            Submit detailed scope for office pricing and proposal preparation.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[calc(90vh-180px)]">
          <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-5">
            {/* Customer Info Section */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Customer Information
              </h4>
              
              <div className="space-y-2">
                <Label htmlFor="customer_name" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Customer Name *
                </Label>
                <Input
                  id="customer_name"
                  value={formData.customer_name}
                  onChange={(e) => handleChange("customer_name", e.target.value)}
                  placeholder="John Smith"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="customer_phone" className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" />
                    Phone
                  </Label>
                  <Input
                    id="customer_phone"
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => handleChange("customer_phone", e.target.value)}
                    placeholder="(555) 123-4567"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_email" className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </Label>
                  <Input
                    id="customer_email"
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => handleChange("customer_email", e.target.value)}
                    placeholder="john@email.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="job_address" className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  Job Site Address
                </Label>
                <Input
                  id="job_address"
                  value={formData.job_address}
                  onChange={(e) => handleChange("job_address", e.target.value)}
                  placeholder="123 Main St, City, CA 90210"
                />
              </div>
            </div>

            {/* Project Details Section */}
            <div className="space-y-4 pt-2">
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Project Details
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="project_type">Project Type</Label>
                  <Select
                    value={formData.project_type}
                    onValueChange={(value) => handleChange("project_type", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="priority" className="flex items-center gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Priority
                  </Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => handleChange("priority", value as Priority)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="scope_description" className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Scope Description *
                </Label>
                <Textarea
                  id="scope_description"
                  value={formData.scope_description}
                  onChange={(e) => handleChange("scope_description", e.target.value)}
                  placeholder="Describe the work in detail: what needs to be done, current conditions, materials discussed, etc."
                  rows={5}
                  required
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="measurements" className="flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5" />
                  Measurements
                </Label>
                <Textarea
                  id="measurements"
                  value={formData.measurements}
                  onChange={(e) => handleChange("measurements", e.target.value)}
                  placeholder="Kitchen: 12ft x 15ft&#10;Countertop: 45 linear ft&#10;Cabinets: 38 linear ft upper, 32 linear ft lower"
                  rows={3}
                  className="resize-none font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="special_requirements">Special Requirements or Notes</Label>
                <Textarea
                  id="special_requirements"
                  value={formData.special_requirements}
                  onChange={(e) => handleChange("special_requirements", e.target.value)}
                  placeholder="Any special conditions, access restrictions, HOA requirements, or customer preferences..."
                  rows={3}
                  className="resize-none"
                />
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t">
              <Button 
                type="submit" 
                className="w-full" 
                size="lg"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Submit for Pricing
                  </>
                )}
              </Button>
            </div>
          </form>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
