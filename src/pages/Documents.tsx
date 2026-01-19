import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FileText, Plus, Trash2, Eye, Send, Loader2, Upload, ExternalLink, CheckCircle, XCircle, Clock, Users, Settings, Pencil, Ban, RefreshCw, Download } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { MultiSignerInput, SignerData } from "@/components/documents/MultiSignerInput";
import { SignatureFieldEditor } from "@/components/documents/SignatureFieldEditor";
import { SignedDocumentView } from "@/components/portal/SignedDocumentView";

interface DocumentSigner {
  id: string;
  signer_name: string;
  signer_email: string;
  signer_order: number;
  status: string;
  signed_at: string | null;
}

interface SignatureDocument {
  id: string;
  document_name: string;
  document_url: string;
  recipient_name: string;
  recipient_email: string;
  status: string;
  sent_at: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  declined_at: string | null;
  decline_reason: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  notes: string | null;
  created_at: string;
  document_signers?: DocumentSigner[];
}

interface SignatureField {
  id: string;
  signerId: string;
  signerName: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  fieldType: "signature" | "date" | "name" | "email" | "text";
  isRequired: boolean;
  fieldLabel?: string;
}

// DB shapes for signed-preview overlay
interface DbSignatureField {
  id: string;
  page_number: number;
  x_position: number;
  y_position: number;
  width: number;
  height: number;
  field_type: string;
  signer_id: string | null;
  is_required: boolean;
  field_label: string | null;
}

interface DbDocumentSignature {
  id: string;
  signer_id: string | null;
  signer_name: string;
  signer_email: string | null;
  signature_type: string;
  signature_data: string;
  signature_font: string | null;
  signed_at: string;
  field_values: Record<string, string> | null;
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {

  pending: { label: "Pending", color: "bg-gray-500", icon: Clock },
  sent: { label: "Sent", color: "bg-blue-500", icon: Send },
  viewed: { label: "Viewed", color: "bg-purple-500", icon: Eye },
  signed: { label: "Signed", color: "bg-green-500", icon: CheckCircle },
  declined: { label: "Declined", color: "bg-red-500", icon: XCircle },
  partial: { label: "Partially Signed", color: "bg-amber-500", icon: Users },
  cancelled: { label: "Cancelled", color: "bg-red-700", icon: Ban },
};

const SIGNER_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"
];

export default function Documents() {
  const { isAdmin, user } = useAuth();
  const queryClient = useQueryClient();
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState<SignatureDocument | null>(null);
  const [currentStep, setCurrentStep] = useState<"upload" | "signers" | "fields">("upload");
  const [uploadedDocUrl, setUploadedDocUrl] = useState<string>("");
  const [uploadedDocId, setUploadedDocId] = useState<string>("");
  const [editingDocument, setEditingDocument] = useState<SignatureDocument | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState("");
  const [resendDialogOpen, setResendDialogOpen] = useState(false);
  const [resendSigner, setResendSigner] = useState<DocumentSigner | null>(null);
  const [resendDocument, setResendDocument] = useState<SignatureDocument | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  // Signed preview dialog
  const [signedViewOpen, setSignedViewOpen] = useState(false);
  const [signedViewDoc, setSignedViewDoc] = useState<SignatureDocument | null>(null);
  const [signedViewFields, setSignedViewFields] = useState<DbSignatureField[]>([]);
  const [signedViewSignatures, setSignedViewSignatures] = useState<DbDocumentSignature[]>([]);
  const [signedViewLoading, setSignedViewLoading] = useState(false);
  
  // Form state
  const [documentName, setDocumentName] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [signers, setSigners] = useState<SignerData[]>([
    { id: crypto.randomUUID(), name: "", email: "", order: 1, color: SIGNER_COLORS[0] }
  ]);
  const [signatureFields, setSignatureFields] = useState<SignatureField[]>([]);

  // Fetch documents with signers
  const { data: documents, isLoading } = useQuery({
    queryKey: ["signature-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signature_documents")
        .select("*, document_signers(*)")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as SignatureDocument[];
    },
  });

  // Upload document and move to signers step
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");

      setUploading(true);

      // Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from("signature-documents")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("signature-documents")
        .getPublicUrl(fileName);

      // Create document record (with first signer as legacy recipient)
      const { data, error } = await supabase
        .from("signature_documents")
        .insert({
          document_name: documentName || selectedFile.name,
          document_url: urlData.publicUrl,
          recipient_name: signers[0]?.name || "Pending",
          recipient_email: signers[0]?.email || "pending@setup.com",
          notes: notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      
      return { docId: data.id, docUrl: urlData.publicUrl };
    },
    onSuccess: (result) => {
      setUploadedDocId(result.docId);
      setUploadedDocUrl(result.docUrl);
      setCurrentStep("signers");
      toast.success("Document uploaded! Now add recipients.");
    },
    onError: (error) => {
      toast.error(`Failed to upload: ${error.message}`);
    },
    onSettled: () => {
      setUploading(false);
    },
  });

  // Save signers and move to field placement
  const saveSignersMutation = useMutation({
    mutationFn: async () => {
      if (!uploadedDocId) throw new Error("No document");
      if (signers.some(s => !s.name || !s.email)) {
        throw new Error("All recipients must have name and email");
      }

      // Update main document with primary signer info
      await supabase
        .from("signature_documents")
        .update({
          recipient_name: signers[0]?.name,
          recipient_email: signers[0]?.email,
        })
        .eq("id", uploadedDocId);

      // Delete existing signers
      await supabase
        .from("document_signers")
        .delete()
        .eq("document_id", uploadedDocId);

      // Insert new signers
      const signersToInsert = signers.map((s, idx) => ({
        document_id: uploadedDocId,
        signer_name: s.name,
        signer_email: s.email,
        signer_order: idx + 1,
      }));

      const { error } = await supabase
        .from("document_signers")
        .insert(signersToInsert);

      if (error) throw error;
    },
    onSuccess: () => {
      setCurrentStep("fields");
      toast.success("Recipients saved! Now place signature fields.");
    },
    onError: (error) => {
      toast.error(`Failed to save: ${error.message}`);
    },
  });

  // Save signature fields and finish
  const saveFieldsMutation = useMutation({
    mutationFn: async () => {
      if (!uploadedDocId) throw new Error("No document");

      // Get signer IDs from database
      const { data: dbSigners } = await supabase
        .from("document_signers")
        .select("id, signer_name, signer_order")
        .eq("document_id", uploadedDocId)
        .order("signer_order");

      if (!dbSigners) throw new Error("No signers found");

      // Map client signers to db signers by order
      const signerIdMap = new Map<string, string>();
      signers.forEach((clientSigner, idx) => {
        const dbSigner = dbSigners.find(d => d.signer_order === idx + 1);
        if (dbSigner) {
          signerIdMap.set(clientSigner.id, dbSigner.id);
        }
      });

      // Delete existing fields
      await supabase
        .from("document_signature_fields")
        .delete()
        .eq("document_id", uploadedDocId);

      // Insert new fields
      // Note: The editor renders the PDF at scale 2 for quality, so field coordinates
      // are in that scaled space. We divide by 2 to normalize to PDF coordinates (scale 1).
      const PDF_EDITOR_SCALE = 2;
      
      if (signatureFields.length > 0) {
        const fieldsToInsert = signatureFields.map(f => ({
          document_id: uploadedDocId,
          signer_id: signerIdMap.get(f.signerId) || null,
          page_number: f.pageNumber,
          // Normalize coordinates from editor scale (2x) to PDF coordinates (1x)
          x_position: f.x / PDF_EDITOR_SCALE,
          y_position: f.y / PDF_EDITOR_SCALE,
          width: f.width / PDF_EDITOR_SCALE,
          height: f.height / PDF_EDITOR_SCALE,
          field_type: f.fieldType,
          is_required: f.isRequired,
          field_label: f.fieldLabel || null,
        }));

        const { error } = await supabase
          .from("document_signature_fields")
          .insert(fieldsToInsert);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-documents"] });
      toast.success("Document setup complete!");
      resetForm();
      setUploadDialogOpen(false);
    },
    onError: (error) => {
      toast.error(`Failed to save fields: ${error.message}`);
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (doc: SignatureDocument) => {
      // Get all signers for this document
      const { data: dbSigners } = await supabase
        .from("document_signers")
        .select("*")
        .eq("document_id", doc.id)
        .order("signer_order");

      const signersToNotify = dbSigners && dbSigners.length > 0
        ? dbSigners
        : [{ signer_name: doc.recipient_name, signer_email: doc.recipient_email, id: null }];

      const { data, error } = await supabase.functions.invoke("send-document-signature", {
        body: {
          documentId: doc.id,
          documentName: doc.document_name,
          recipients: signersToNotify.map((s: any) => ({
            recipientName: s.signer_name,
            recipientEmail: s.signer_email,
            signerId: s.id,
          })),
        },
      });

      if (error) throw error;
      if (!data?.success) {
        const msg = typeof data?.error === "string" ? data.error : "Failed to send document";
        throw new Error(msg);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-documents"] });
      toast.success("Document sent to all recipients!");
      setSendDialogOpen(false);
      setSelectedDocument(null);
    },
    onError: (error: any) => {
      const msg = typeof error?.message === "string" ? error.message : "Unknown error";
      if (msg.includes("rate_limit_exceeded")) {
        toast.error("Email provider rate limited. Please wait ~30 seconds and try again.");
        return;
      }
      toast.error(`Failed to send: ${msg}`);
    },
  });

  // Resend to individual signer
  const resendMutation = useMutation({
    mutationFn: async ({ doc, signer }: { doc: SignatureDocument; signer: DocumentSigner }) => {
      const { data, error } = await supabase.functions.invoke("send-document-signature", {
        body: {
          documentId: doc.id,
          documentName: doc.document_name,
          recipientName: signer.signer_name,
          recipientEmail: signer.signer_email,
          signerId: signer.id,
          isReminder: true,
        },
      });

      if (error) throw error;
      if (!data?.success) {
        const msg = typeof data?.error === "string" ? data.error : "Failed to send reminder";
        throw new Error(msg);
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-documents"] });
      toast.success("Reminder sent successfully!");
      setResendDialogOpen(false);
      setResendSigner(null);
      setResendDocument(null);
    },
    onError: (error: any) => {
      const msg = typeof error?.message === "string" ? error.message : "Unknown error";
      if (msg.includes("rate_limit_exceeded")) {
        toast.error("Email provider rate limited. Please wait ~30 seconds and try again.");
        return;
      }
      toast.error(`Failed to send reminder: ${msg}`);
    },
  });

  // Delete document
  const deleteMutation = useMutation({
    mutationFn: async (docId: string) => {
      const { error } = await supabase
        .from("signature_documents")
        .delete()
        .eq("id", docId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-documents"] });
      toast.success("Document deleted");
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  // Cancel document
  const cancelMutation = useMutation({
    mutationFn: async ({ docId, reason }: { docId: string; reason: string }) => {
      const { data, error } = await supabase.functions.invoke("cancel-document-signature", {
        body: {
          documentId: docId,
          cancellationReason: reason,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["signature-documents"] });
      toast.success("Document cancelled and signers notified");
      setCancelDialogOpen(false);
      setSelectedDocument(null);
      setCancellationReason("");
    },
    onError: (error) => {
      toast.error(`Failed to cancel: ${error.message}`);
    },
  });

  const resetForm = () => {
    setDocumentName("");
    setNotes("");
    setSelectedFile(null);
    setSigners([{ id: crypto.randomUUID(), name: "", email: "", order: 1, color: SIGNER_COLORS[0] }]);
    setSignatureFields([]);
    setCurrentStep("upload");
    setUploadedDocId("");
    setUploadedDocUrl("");
    setEditingDocument(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!documentName) {
        setDocumentName(file.name.replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleSendClick = (doc: SignatureDocument) => {
    setSelectedDocument(doc);
    setSendDialogOpen(true);
  };

  const handleViewSigned = useCallback(async (doc: SignatureDocument) => {
    setSignedViewOpen(true);
    setSignedViewDoc(doc);
    setSignedViewLoading(true);

    try {
      const [fieldsRes, sigRes] = await Promise.all([
        supabase
          .from("document_signature_fields")
          .select("*")
          .eq("document_id", doc.id),
        supabase
          .from("document_signatures")
          .select("*")
          .eq("document_id", doc.id),
      ]);

      if (fieldsRes.error) throw fieldsRes.error;
      if (sigRes.error) throw sigRes.error;

      setSignedViewFields((fieldsRes.data || []) as DbSignatureField[]);
      setSignedViewSignatures(
        ((sigRes.data || []) as any[]).map((s) => ({
          ...s,
          field_values: (s.field_values as Record<string, string>) || {},
        })) as DbDocumentSignature[]
      );
    } catch (err: any) {
      const msg = typeof err?.message === "string" ? err.message : "Unknown error";
      toast.error(`Failed to load signed view: ${msg}`);
      setSignedViewOpen(false);
    } finally {
      setSignedViewLoading(false);
    }
  }, []);

  const handleDownloadSignedPdf = useCallback(async (doc: SignatureDocument) => {
    setDownloadingDocId(doc.id);
    try {
      const { data, error } = await supabase.functions.invoke("generate-signed-document-pdf", {
        body: { documentId: doc.id, includeAuditTrail: true },
      });

      if (error) throw error;
      if (!data?.pdf) throw new Error("No PDF data returned");

      // Convert base64 to blob and download
      const binaryString = atob(data.pdf);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = data.filename || `${doc.document_name.replace(/\.pdf$/i, "")}_signed.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success("Signed document downloaded!");
    } catch (err: any) {
      const msg = typeof err?.message === "string" ? err.message : "Unknown error";
      toast.error(`Failed to download: ${msg}`);
    } finally {
      setDownloadingDocId(null);
    }
  }, []);

  const handleEditClick = async (doc: SignatureDocument) => {

    setEditingDocument(doc);
    setUploadedDocId(doc.id);
    setUploadedDocUrl(doc.document_url);
    setDocumentName(doc.document_name);
    setNotes(doc.notes || "");
    
    // Load signers
    const { data: dbSigners } = await supabase
      .from("document_signers")
      .select("*")
      .eq("document_id", doc.id)
      .order("signer_order");
    
    if (dbSigners && dbSigners.length > 0) {
      setSigners(dbSigners.map((s, idx) => ({
        id: s.id,
        name: s.signer_name,
        email: s.signer_email,
        order: s.signer_order,
        color: SIGNER_COLORS[idx % SIGNER_COLORS.length],
      })));
    } else {
      setSigners([{
        id: crypto.randomUUID(),
        name: doc.recipient_name,
        email: doc.recipient_email,
        order: 1,
        color: SIGNER_COLORS[0],
      }]);
    }
    
    // Load existing fields
    // Note: Fields are stored in PDF coordinates (scale 1), but the editor uses scale 2
    const PDF_EDITOR_SCALE = 2;
    
    const { data: dbFields } = await supabase
      .from("document_signature_fields")
      .select("*, document_signers(signer_name)")
      .eq("document_id", doc.id);
    
    if (dbFields && dbFields.length > 0) {
      setSignatureFields(dbFields.map(f => ({
        id: f.id,
        signerId: f.signer_id || "",
        signerName: f.document_signers?.signer_name || "Unknown",
        pageNumber: f.page_number,
        // Convert from PDF coordinates (1x) to editor scale (2x)
        x: f.x_position * PDF_EDITOR_SCALE,
        y: f.y_position * PDF_EDITOR_SCALE,
        width: f.width * PDF_EDITOR_SCALE,
        height: f.height * PDF_EDITOR_SCALE,
        fieldType: f.field_type as any,
        isRequired: f.is_required,
        fieldLabel: f.field_label || undefined,
      })));
    } else {
      setSignatureFields([]);
    }
    
    setCurrentStep("signers");
    setUploadDialogOpen(true);
  };

  const handleCancelClick = (doc: SignatureDocument) => {
    setSelectedDocument(doc);
    setCancelDialogOpen(true);
  };

  const handleResendClick = (doc: SignatureDocument, signer: DocumentSigner) => {
    setResendDocument(doc);
    setResendSigner(signer);
    setResendDialogOpen(true);
  };

  const handleFieldsChange = useCallback((fields: SignatureField[]) => {
    setSignatureFields(fields);
  }, []);

  const getDocumentStatus = (doc: SignatureDocument): string => {
    if (!doc.document_signers || doc.document_signers.length === 0) {
      return doc.status;
    }
    
    const signedCount = doc.document_signers.filter(s => s.status === 'signed').length;
    const totalSigners = doc.document_signers.length;
    
    if (signedCount === totalSigners && totalSigners > 0) return 'signed';
    if (signedCount > 0) return 'partial';
    if (doc.document_signers.some(s => s.status === 'declined')) return 'declined';
    if (doc.document_signers.some(s => s.status === 'viewed')) return 'viewed';
    if (doc.document_signers.some(s => s.status === 'sent')) return 'sent';
    return 'pending';
  };

  const pendingCount = documents?.filter(d => getDocumentStatus(d) === 'pending').length || 0;
  const sentCount = documents?.filter(d => ['sent', 'viewed', 'partial'].includes(getDocumentStatus(d))).length || 0;
  const signedCount = documents?.filter(d => getDocumentStatus(d) === 'signed').length || 0;

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
            <p className="text-muted-foreground">
              Upload documents and send them for signature
            </p>
          </div>
          <Button onClick={() => setUploadDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Upload Document
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingCount}</div>
              <p className="text-xs text-muted-foreground">Not yet sent</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Awaiting Signature</CardTitle>
              <Send className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sentCount}</div>
              <p className="text-xs text-muted-foreground">Sent to recipients</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Signed</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{signedCount}</div>
              <p className="text-xs text-muted-foreground">Completed</p>
            </CardContent>
          </Card>
        </div>

        {/* Documents Table */}
        <Card>
          <CardHeader>
            <CardTitle>All Documents</CardTitle>
            <CardDescription>
              Manage your documents and track signature status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : documents?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold">No Documents</h3>
                <p className="text-muted-foreground mb-4">
                  Upload your first document to send for signature.
                </p>
                <Button onClick={() => setUploadDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Document</TableHead>
                    <TableHead>Recipients</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Date Emailed</TableHead>
                    <TableHead className="w-[180px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {documents?.map((doc) => {
                    const docStatus = getDocumentStatus(doc);
                    const status = statusConfig[docStatus] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    const signerCount = doc.document_signers?.length || 1;
                    const signedSigners = doc.document_signers?.filter(s => s.status === 'signed').length || 0;
                    const canEdit = docStatus === "pending" && !doc.sent_at;
                    const canCancel = doc.sent_at && docStatus !== "signed" && docStatus !== "cancelled" && docStatus !== "declined";
                    
                    return (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{doc.document_name}</span>
                            {doc.notes && (
                              <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {doc.notes}
                              </span>
                            )}
                            {doc.cancellation_reason && (
                              <span className="text-xs text-red-500 truncate max-w-[200px]">
                                Cancelled: {doc.cancellation_reason}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {doc.document_signers && doc.document_signers.length > 0 ? (
                            <div className="flex flex-col gap-1">
                              {doc.document_signers.map((signer) => {
                                const canResend = doc.sent_at && 
                                  signer.status !== 'signed' && 
                                  signer.status !== 'declined' && 
                                  docStatus !== 'cancelled' && 
                                  docStatus !== 'signed';
                                
                                return (
                                  <div key={signer.id} className="flex items-center gap-2 text-sm">
                                    {signer.status === 'signed' ? (
                                      <CheckCircle className="h-3 w-3 text-green-500" />
                                    ) : signer.status === 'declined' ? (
                                      <XCircle className="h-3 w-3 text-red-500" />
                                    ) : (
                                      <Clock className="h-3 w-3 text-muted-foreground" />
                                    )}
                                    <span className="truncate max-w-[120px]">{signer.signer_name}</span>
                                    {signer.signed_at && (
                                      <span className="text-xs text-muted-foreground">
                                        {format(new Date(signer.signed_at), "M/d/yy")}
                                      </span>
                                    )}
                                    {canResend && (
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 text-muted-foreground hover:text-primary"
                                              onClick={() => handleResendClick(doc, signer)}
                                              disabled={resendMutation.isPending}
                                            >
                                              <RefreshCw className="h-3 w-3" />
                                            </Button>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            <p>Resend signature request</p>
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <span className="font-medium">{doc.recipient_name}</span>
                              <span className="text-xs text-muted-foreground">{doc.recipient_email}</span>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <Badge className={`${status.color} text-white w-fit`}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {status.label}
                            </Badge>
                            {signerCount > 1 && docStatus !== "cancelled" && (
                              <span className="text-xs text-muted-foreground">
                                {signedSigners}/{signerCount} signed
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {format(new Date(doc.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell>
                          {doc.sent_at ? (
                            format(new Date(doc.sent_at), "MMM d, yyyy")
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => window.open(doc.document_url, "_blank")}
                              title="View Original PDF"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                            {(docStatus === "signed" || signedSigners > 0) && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleViewSigned(doc)}
                                title="View Signed Document"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            )}
                            {docStatus === "signed" && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDownloadSignedPdf(doc)}
                                      disabled={downloadingDocId === doc.id}
                                      title="Download Signed PDF with Certificate"
                                    >
                                      {downloadingDocId === doc.id ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Download className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Download signed PDF with audit certificate</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}

                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEditClick(doc)}
                                title="Edit Document"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            )}
                            {docStatus === "pending" && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleSendClick(doc)}
                                title="Send for Signature"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            )}
                            {canCancel && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleCancelClick(doc)}
                                title="Cancel Document"
                                className="text-amber-600 hover:text-amber-700"
                              >
                                <Ban className="h-4 w-4" />
                              </Button>
                            )}
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Document</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{doc.document_name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => deleteMutation.mutate(doc.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Signed Document Preview Dialog */}
      <Dialog
        open={signedViewOpen}
        onOpenChange={(open) => {
          setSignedViewOpen(open);
          if (!open) {
            setSignedViewDoc(null);
            setSignedViewFields([]);
            setSignedViewSignatures([]);
            setSignedViewLoading(false);
          }
        }}
      >
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Signed Document</DialogTitle>
            <DialogDescription>
              This view shows signatures/fields as overlays on the original PDF.
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-auto" style={{ maxHeight: "calc(95vh - 140px)" }}>
            {signedViewLoading ? (
              <div className="min-h-[40vh] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : signedViewDoc ? (
              <SignedDocumentView
                documentUrl={signedViewDoc.document_url}
                documentName={signedViewDoc.document_name}
                fields={signedViewFields as any}
                signatures={signedViewSignatures as any}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* Multi-step Upload/Edit Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {

        if (!open) { resetForm(); }
        setUploadDialogOpen(open);
      }}>
        <DialogContent className={currentStep === "fields" ? "max-w-[95vw] max-h-[95vh]" : "sm:max-w-lg"}>
          <DialogHeader>
            <DialogTitle>
              {editingDocument ? (
                <>
                  {currentStep === "signers" && "Edit Recipients"}
                  {currentStep === "fields" && "Edit Signature Fields"}
                </>
              ) : (
                <>
                  {currentStep === "upload" && "Upload Document"}
                  {currentStep === "signers" && "Add Recipients"}
                  {currentStep === "fields" && "Place Signature Fields"}
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingDocument ? (
                <>
                  {currentStep === "signers" && `Editing "${editingDocument.document_name}" - Update recipients`}
                  {currentStep === "fields" && "Update signature fields on the document"}
                </>
              ) : (
                <>
                  {currentStep === "upload" && "Upload a PDF document to send for signature"}
                  {currentStep === "signers" && "Add the people who need to sign this document"}
                  {currentStep === "fields" && "Drag and drop signature fields onto the document"}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 py-2">
            {(editingDocument ? ["signers", "fields"] : ["upload", "signers", "fields"]).map((step, idx) => (
              <div key={step} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === step 
                    ? "bg-primary text-primary-foreground" 
                    : (editingDocument ? ["signers", "fields"] : ["upload", "signers", "fields"]).indexOf(currentStep) > idx
                      ? "bg-green-500 text-white"
                      : "bg-muted text-muted-foreground"
                }`}>
                  {idx + 1}
                </div>
                {idx < (editingDocument ? 1 : 2) && <div className="w-8 h-0.5 bg-muted" />}
              </div>
            ))}
          </div>

          {currentStep === "upload" && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="file">Document File (PDF)</Label>
                <label 
                  htmlFor="file" 
                  className={`
                    flex flex-col items-center justify-center w-full h-32 px-4 
                    border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200
                    ${selectedFile 
                      ? 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2' 
                      : 'border-muted-foreground/25 hover:border-primary hover:bg-accent/50'
                    }
                    focus-within:border-primary focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2
                  `}
                >
                  <div className="flex flex-col items-center justify-center pt-2 pb-3">
                    <Upload className={`h-8 w-8 mb-2 ${selectedFile ? 'text-primary' : 'text-muted-foreground'}`} />
                    {selectedFile ? (
                      <>
                        <p className="text-sm font-medium text-primary">{selectedFile.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">Click to change file</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-medium">Click to upload PDF</p>
                        <p className="text-xs text-muted-foreground mt-1">or drag and drop</p>
                      </>
                    )}
                  </div>
                  <Input
                    id="file"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                </label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="docName">Document Name</Label>
                <Input
                  id="docName"
                  value={documentName}
                  onChange={(e) => setDocumentName(e.target.value)}
                  placeholder="Enter document name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes..."
                  rows={2}
                />
              </div>
            </div>
          )}

          {currentStep === "signers" && (
            <div className="py-4">
              <MultiSignerInput signers={signers} onChange={setSigners} />
            </div>
          )}

          {currentStep === "fields" && (
            <div className="py-4 overflow-auto" style={{ maxHeight: "calc(95vh - 200px)" }}>
              <SignatureFieldEditor
                documentUrl={uploadedDocUrl}
                signers={signers}
                onFieldsChange={handleFieldsChange}
                initialFields={signatureFields}
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            {currentStep !== "upload" && !editingDocument && (
              <Button
                variant="outline"
                onClick={() => {
                  if (currentStep === "signers") setCurrentStep("upload");
                  if (currentStep === "fields") setCurrentStep("signers");
                }}
              >
                Back
              </Button>
            )}
            {editingDocument && currentStep === "fields" && (
              <Button
                variant="outline"
                onClick={() => setCurrentStep("signers")}
              >
                Back
              </Button>
            )}
            <Button variant="outline" onClick={() => { setUploadDialogOpen(false); resetForm(); }}>
              Cancel
            </Button>
            
            {currentStep === "upload" && !editingDocument && (
              <Button
                onClick={() => uploadMutation.mutate()}
                disabled={!selectedFile || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Continue
                  </>
                )}
              </Button>
            )}

            {currentStep === "signers" && (
              <Button
                onClick={() => saveSignersMutation.mutate()}
                disabled={signers.some(s => !s.name || !s.email) || saveSignersMutation.isPending}
              >
                {saveSignersMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Users className="mr-2 h-4 w-4" />
                )}
                Save & Continue
              </Button>
            )}

            {currentStep === "fields" && (
              <Button
                onClick={() => saveFieldsMutation.mutate()}
                disabled={saveFieldsMutation.isPending}
              >
                {saveFieldsMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                {editingDocument ? "Save Changes" : "Complete Setup"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Confirmation Dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send for Signature</DialogTitle>
            <DialogDescription>
              Send "{selectedDocument?.document_name}" to {
                selectedDocument?.document_signers && selectedDocument.document_signers.length > 0
                  ? `${selectedDocument.document_signers.length} recipient(s)`
                  : selectedDocument?.recipient_name
              } for signature?
            </DialogDescription>
          </DialogHeader>
          {selectedDocument?.document_signers && selectedDocument.document_signers.length > 0 && (
            <div className="py-4 space-y-2">
              <Label>Recipients:</Label>
              {selectedDocument.document_signers.map((signer) => (
                <div key={signer.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span>{signer.signer_name}</span>
                  <span className="text-muted-foreground">({signer.signer_email})</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => selectedDocument && sendMutation.mutate(selectedDocument)}
              disabled={sendMutation.isPending}
            >
              {sendMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Send to All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Document Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setCancellationReason("");
          setSelectedDocument(null);
        }
        setCancelDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Document Request</DialogTitle>
            <DialogDescription>
              Cancel the signature request for "{selectedDocument?.document_name}"? 
              All recipients who have been sent the document will be notified.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cancellationReason">Reason for Cancellation</Label>
              <Textarea
                id="cancellationReason"
                value={cancellationReason}
                onChange={(e) => setCancellationReason(e.target.value)}
                placeholder="Enter the reason for cancelling this document request..."
                rows={3}
              />
            </div>
            {selectedDocument?.document_signers && selectedDocument.document_signers.length > 0 && (
              <div className="space-y-2">
                <Label>Recipients to be notified:</Label>
                {selectedDocument.document_signers
                  .filter(s => s.status !== 'pending' && s.status !== 'signed')
                  .map((signer) => (
                    <div key={signer.id} className="flex items-center gap-2 text-sm p-2 bg-muted/50 rounded">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{signer.signer_name}</span>
                      <span className="text-muted-foreground">({signer.signer_email})</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Keep Document
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedDocument && cancelMutation.mutate({ 
                docId: selectedDocument.id, 
                reason: cancellationReason 
              })}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Ban className="mr-2 h-4 w-4" />
                  Cancel Document
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend Confirmation Dialog */}
      <Dialog open={resendDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setResendSigner(null);
          setResendDocument(null);
        }
        setResendDialogOpen(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Resend Signature Request</DialogTitle>
            <DialogDescription>
              Send a reminder email to {resendSigner?.signer_name} for "{resendDocument?.document_name}"?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="flex items-center gap-2 text-sm p-3 bg-muted/50 rounded">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{resendSigner?.signer_name}</span>
              <span className="text-muted-foreground">({resendSigner?.signer_email})</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResendDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => resendDocument && resendSigner && resendMutation.mutate({ doc: resendDocument, signer: resendSigner })}
              disabled={resendMutation.isPending}
            >
              {resendMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Send Reminder
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
