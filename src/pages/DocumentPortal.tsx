import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, FileText, CheckCircle, XCircle, Download, Calendar, Mail, User, Shield, Eye } from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/portal/SignatureCanvas";
import { DocumentSigningView } from "@/components/portal/DocumentSigningView";
import { SignedDocumentView } from "@/components/portal/SignedDocumentView";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface SignatureField {
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

export default function DocumentPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const signerId = searchParams.get("signer");
  const queryClient = useQueryClient();

  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signatureData, setSignatureData] = useState<{ type: "typed" | "drawn"; data: string; font?: string } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [textFieldValues, setTextFieldValues] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showSignedPreview, setShowSignedPreview] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState<'signed' | 'audit' | null>(null);

  // Fetch document data via token
  const { data, isLoading, error } = useQuery({
    queryKey: ["document-portal", token],
    queryFn: async () => {
      if (!token) throw new Error("No token provided");

      // Get token and document
      const { data: tokenData, error: tokenError } = await supabase
        .from("document_portal_tokens")
        .select("*, signature_documents(*)")
        .eq("token", token)
        .eq("is_active", true)
        .single();

      if (tokenError || !tokenData) {
        throw new Error("Invalid or expired link");
      }

      // Check expiration
      if (tokenData.expires_at && new Date(tokenData.expires_at) < new Date()) {
        throw new Error("This link has expired");
      }

      // Update access tracking
      await supabase
        .from("document_portal_tokens")
        .update({
          access_count: (tokenData.access_count || 0) + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq("id", tokenData.id);

      // Get signature fields
      const { data: fields } = await supabase
        .from("document_signature_fields")
        .select("*")
        .eq("document_id", tokenData.document_id);

      // Get all signers for this document
      const { data: signers } = await supabase
        .from("document_signers")
        .select("*")
        .eq("document_id", tokenData.document_id)
        .order("signer_order");

      // Get existing signatures
      const { data: signatures } = await supabase
        .from("document_signatures")
        .select("*")
        .eq("document_id", tokenData.document_id);

      const doc = tokenData.signature_documents;
      
      // If we have a specific signer, check their status
      let currentSigner = null;
      if (signerId && signers) {
        currentSigner = signers.find(s => s.id === signerId);
      } else if (signers && signers.length > 0) {
        // Find first unsigned signer
        currentSigner = signers.find(s => s.status !== 'signed');
      }

      // Update document viewed status if not already signed
      if (doc && doc.status === "sent") {
        await supabase
          .from("signature_documents")
          .update({
            status: "viewed",
            viewed_at: new Date().toISOString(),
          })
          .eq("id", doc.id);
      }

      // Update signer viewed status
      if (currentSigner && currentSigner.status === "sent") {
        await supabase
          .from("document_signers")
          .update({
            status: "viewed",
            viewed_at: new Date().toISOString(),
          })
          .eq("id", currentSigner.id);
      }

      // Pre-fill signer info
      if (currentSigner) {
        setSignerName(currentSigner.signer_name || "");
        setSignerEmail(currentSigner.signer_email || "");
      } else if (doc) {
        setSignerName(doc.recipient_name || "");
        setSignerEmail(doc.recipient_email || "");
      }

      return {
        token: tokenData,
        document: doc,
        fields: fields as SignatureField[] || [],
        signers: signers || [],
        signatures: signatures || [],
        currentSigner,
      };
    },
    enabled: !!token,
  });

  // Validate required fields
  const validateRequiredFields = useCallback(() => {
    const errors: string[] = [];
    
    if (!signerName) {
      errors.push("Full Name is required");
    }
    
    if (!signatureData) {
      errors.push("Signature is required");
    }
    
    // Check required text fields for current signer
    const myFields = data?.fields?.filter(f => 
      f.signer_id === data.currentSigner?.id && f.is_required
    ) || [];
    
    myFields.forEach(field => {
      if (field.field_type === "text") {
        const value = textFieldValues[field.id];
        if (!value || value.trim() === "") {
          errors.push(`${field.field_label || "Text field"} is required`);
        }
      }
    });
    
    return errors;
  }, [data, signerName, signatureData, textFieldValues]);

  // Sign mutation - accepts signature data as parameter for the new signing view
  const signMutation = useMutation({
    mutationFn: async (params?: { 
      sigData?: { type: "typed" | "drawn"; data: string; font?: string };
      textValues?: Record<string, string>;
    }) => {
      if (!data?.document) throw new Error("Document not found");
      
      // Use passed signature data or the state
      const sigToUse = params?.sigData || signatureData;
      const textValuesToUse = params?.textValues || textFieldValues;
      
      if (!sigToUse) {
        throw new Error("Signature is required");
      }
      
      if (!signerName) {
        throw new Error("Name is required");
      }

      const signedAt = new Date().toISOString();

      // Build field values object for all fields (name, email, date, text)
      const fieldValues: Record<string, string> = {
        ...textValuesToUse,
        _signerName: signerName,
        _signerEmail: signerEmail || "",
        _signedDate: signedAt,
      };

      // Save signature with full audit info including field values
      const { error: sigError } = await supabase.from("document_signatures").insert({
        document_id: data.document.id,
        signer_id: data.currentSigner?.id || null,
        signer_name: signerName,
        signer_email: signerEmail || null,
        signature_type: sigToUse.type,
        signature_data: sigToUse.data,
        signature_font: sigToUse.font || null,
        ip_address: null, // Would need server-side to capture
        user_agent: navigator.userAgent,
        signed_at: signedAt,
        field_values: fieldValues,
      } as any);

      if (sigError) throw sigError;

      // Update signer status if we have one
      if (data.currentSigner) {
        await supabase
          .from("document_signers")
          .update({
            status: "signed",
            signed_at: signedAt,
          })
          .eq("id", data.currentSigner.id);
      }

      // Check if all signers have signed
      const { data: allSigners } = await supabase
        .from("document_signers")
        .select("status")
        .eq("document_id", data.document.id);

      const allSigned = allSigners && allSigners.length > 0 
        ? allSigners.every(s => s.status === "signed")
        : true;

      // Update document status
      await supabase
        .from("signature_documents")
        .update({
          status: allSigned ? "signed" : "viewed",
          signed_at: allSigned ? signedAt : null,
        })
        .eq("id", data.document.id);

      // Notify admin
      await supabase.functions.invoke("send-proposal-notification", {
        body: {
          action: "document_signed",
          documentName: data.document.document_name,
          recipientName: signerName,
          recipientEmail: signerEmail,
          signedAt: signedAt,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-portal", token] });
      toast.success("Document signed successfully!");
    },
    onError: (error) => {
      toast.error(`Failed to sign: ${error.message}`);
    },
  });

  // Decline mutation
  const declineMutation = useMutation({
    mutationFn: async () => {
      if (!data?.document) throw new Error("Document not found");

      const declinedAt = new Date().toISOString();

      // Update signer status if we have one
      if (data.currentSigner) {
        await supabase
          .from("document_signers")
          .update({
            status: "declined",
            declined_at: declinedAt,
            decline_reason: declineReason || null,
          })
          .eq("id", data.currentSigner.id);
      }

      const { error } = await supabase
        .from("signature_documents")
        .update({
          status: "declined",
          declined_at: declinedAt,
          decline_reason: declineReason || null,
        })
        .eq("id", data.document.id);

      if (error) throw error;

      // Notify admin
      await supabase.functions.invoke("send-proposal-notification", {
        body: {
          action: "document_declined",
          documentName: data.document.document_name,
          recipientName: data.document.recipient_name,
          recipientEmail: data.document.recipient_email,
          declineReason: declineReason,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["document-portal", token] });
      toast.success("Document declined");
    },
    onError: (error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const handleSignatureComplete = (sigData: { type: "typed" | "drawn"; data: string; font?: string }) => {
    setSignatureData(sigData);
  };

  const handleDownloadSignedPdf = async (includeAuditTrail: boolean) => {
    if (!data?.document) return;
    
    setDownloadingPdf(includeAuditTrail ? 'audit' : 'signed');
    try {
      const response = await supabase.functions.invoke('generate-signed-document-pdf', {
        body: {
          documentId: data.document.id,
          includeAuditTrail,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate PDF');
      }

      const { pdf, filename } = response.data;
      
      // Convert base64 to blob and download
      const byteCharacters = atob(pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = includeAuditTrail 
        ? filename.replace('.pdf', '_with_certificate.pdf')
        : filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('PDF downloaded successfully');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF');
    } finally {
      setDownloadingPdf(null);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Invalid Link</CardTitle>
            <CardDescription>
              This link is invalid. Please contact the sender for a new link.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data?.document) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Link Expired or Invalid</CardTitle>
            <CardDescription>
              {error?.message || "This link is no longer valid. Please contact the sender."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const doc = data.document;
  const currentSignerSigned = data.currentSigner?.status === 'signed';
  const allSignersSigned = data.signers.length > 0 
    ? data.signers.every(s => s.status === 'signed')
    : doc.status === "signed";

  // Check if current signer already signed
  if (currentSignerSigned || (doc.status === "signed" && !data.currentSigner)) {
    const signature = data.signatures.find(s => s.signer_id === data.currentSigner?.id) || data.signatures[0];
    const hasPositionedFields = data.fields && data.fields.length > 0;
    
    return (
      <div className="min-h-screen bg-muted/30 py-8 px-4">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Success Header */}
          <Card>
            <CardHeader className="text-center pb-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <CardTitle>Document Signed</CardTitle>
              <CardDescription>
                Thank you! This document has been signed successfully.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <h4 className="font-semibold flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Signature Audit Trail
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Signed By:</span>
                    <span className="font-medium">{signature?.signer_name || signerName || doc.recipient_name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Email:</span>
                    <span>{signature?.signer_email || signerEmail || doc.recipient_email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Date Signed:</span>
                    <span>{signature?.signed_at ? format(new Date(signature.signed_at), "PPpp") : 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Document:</span>
                    <span className="truncate">{doc.document_name}</span>
                  </div>
                </div>
              </div>

              {/* Show all signers status if multiple */}
              {data.signers.length > 1 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-3">All Signatures</h4>
                  <div className="space-y-2">
                    {data.signers.map((signer) => {
                      const sig = data.signatures.find(s => s.signer_id === signer.id);
                      return (
                        <div key={signer.id} className="flex items-center justify-between text-sm">
                          <span>{signer.signer_name}</span>
                          {signer.status === 'signed' ? (
                            <Badge className="bg-green-500">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Signed {sig?.signed_at ? format(new Date(sig.signed_at), "M/d/yy") : ''}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap justify-center gap-3 pt-2">
                <Button variant="outline" onClick={() => window.open(doc.document_url, "_blank")}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Original
                </Button>
                {hasPositionedFields && (
                  <>
                    <Button variant="outline" onClick={() => setShowSignedPreview(true)}>
                      <Eye className="mr-2 h-4 w-4" />
                      Preview Signed
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => handleDownloadSignedPdf(false)}
                      disabled={downloadingPdf !== null}
                    >
                      {downloadingPdf === 'signed' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Download Signed
                    </Button>
                    <Button 
                      onClick={() => handleDownloadSignedPdf(true)}
                      disabled={downloadingPdf !== null}
                    >
                      {downloadingPdf === 'audit' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Shield className="mr-2 h-4 w-4" />
                      )}
                      Download with Certificate
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Signed Document Dialog */}
          <Dialog open={showSignedPreview} onOpenChange={setShowSignedPreview}>
            <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
              <DialogHeader>
                <DialogTitle>Signed Document Preview</DialogTitle>
              </DialogHeader>
              <SignedDocumentView
                documentUrl={doc.document_url}
                documentName={doc.document_name}
                fields={data.fields}
                signatures={data.signatures.map(sig => ({
                  ...sig,
                  field_values: (sig.field_values as Record<string, string>) || {},
                }))}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>
    );
  }

  // Declined
  if (doc.status === "declined" || data.currentSigner?.status === "declined") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Document Declined</CardTitle>
            <CardDescription>
              This document has been declined.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  // Check if we should use the new overlay signing view (has positioned fields)
  const hasPositionedFields = data.fields && data.fields.length > 0;

  // Handler for the new signing view - uses the memoized callback
  const handleSignWithView = (
    sigData: { type: "typed" | "drawn"; data: string; font?: string },
    textValues: Record<string, string>
  ) => {
    setTextFieldValues(textValues);
    signMutation.mutate({ sigData, textValues });
  };

  // Use new overlay signing view when fields are positioned on the document
  if (hasPositionedFields) {
    return (
      <div className="min-h-screen bg-muted/30 py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <DocumentSigningView
            documentUrl={doc.document_url}
            documentName={doc.document_name}
            fields={data.fields}
            currentSignerId={data.currentSigner?.id || null}
            signerName={signerName}
            signerEmail={signerEmail}
            onSignerNameChange={setSignerName}
            onSignerEmailChange={setSignerEmail}
            onSign={handleSignWithView}
            onDecline={() => setShowDeclineForm(true)}
            isSubmitting={signMutation.isPending}
          />
          
          {/* Decline Form Overlay */}
          {showDeclineForm && (
            <>
              <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowDeclineForm(false)} />
              <Card className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] z-50">
                <CardHeader>
                  <CardTitle>Decline Document</CardTitle>
                  <CardDescription>
                    Please let us know why you're declining this document
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reason">Reason (optional)</Label>
                    <Input
                      id="reason"
                      value={declineReason}
                      onChange={(e) => setDeclineReason(e.target.value)}
                      placeholder="Enter reason for declining"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="destructive"
                      onClick={() => declineMutation.mutate()}
                      disabled={declineMutation.isPending}
                    >
                      {declineMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Declining...
                        </>
                      ) : (
                        "Confirm Decline"
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => setShowDeclineForm(false)}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    );
  }

  // Fallback: Original signing UI for documents without positioned fields
  return (
    <div className="min-h-screen bg-muted/30 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <CardTitle>{doc.document_name}</CardTitle>
                <CardDescription>
                  Please review and sign this document
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 items-center">
              <Button onClick={() => window.open(doc.document_url, "_blank")}>
                <Download className="mr-2 h-4 w-4" />
                View Document
              </Button>
              {data.signers.length > 1 && (
                <div className="text-sm text-muted-foreground">
                  {data.signers.filter(s => s.status === 'signed').length} of {data.signers.length} signatures collected
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Document Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Document Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <iframe
              src={doc.document_url}
              className="w-full h-[600px] border rounded-lg"
              title="Document Preview"
            />
          </CardContent>
        </Card>

        {/* Signature Section */}
        {!showDeclineForm ? (
          <Card>
            <CardHeader>
              <CardTitle>Sign Document</CardTitle>
              <CardDescription>
                Enter your information and provide your signature below
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Validation Errors */}
              {validationErrors.length > 0 && (
                <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/30">
                  <div className="flex items-center gap-2 text-destructive mb-2">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium">Please complete all required fields</span>
                  </div>
                  <ul className="list-disc list-inside text-sm text-destructive">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder="Enter your full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={signerEmail}
                    onChange={(e) => setSignerEmail(e.target.value)}
                    placeholder="your@email.com"
                  />
                </div>
              </div>

              {/* Text Fields for this signer */}
              {(() => {
                const textFields = data.fields?.filter(f => 
                  f.field_type === "text" && f.signer_id === data.currentSigner?.id
                ) || [];
                
                if (textFields.length === 0) return null;
                
                return (
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium">Additional Information</h4>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {textFields.map((field) => (
                        <div key={field.id} className="space-y-2">
                          <Label htmlFor={`field-${field.id}`}>
                            {field.field_label || "Text Field"}
                            {field.is_required && <span className="text-destructive"> *</span>}
                          </Label>
                          <Input
                            id={`field-${field.id}`}
                            value={textFieldValues[field.id] || ""}
                            onChange={(e) => setTextFieldValues(prev => ({
                              ...prev,
                              [field.id]: e.target.value
                            }))}
                            placeholder={`Enter ${field.field_label || "text"}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="space-y-2">
                <Label>Your Signature *</Label>
                <SignatureCanvas
                  onSignatureComplete={handleSignatureComplete}
                  signerName={signerName}
                />
              </div>

              {signatureData && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400 mb-2">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Signature captured</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    By signing, you agree that your signature, name, email, date ({format(new Date(), "PPpp")}), and IP address will be recorded for verification.
                  </p>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-4">
                <Button
                  onClick={() => {
                    const errors = validateRequiredFields();
                    if (errors.length > 0) {
                      setValidationErrors(errors);
                      toast.error("Please complete all required fields before signing");
                      return;
                    }
                    setValidationErrors([]);
                    signMutation.mutate({});
                  }}
                  disabled={signMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {signMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Signing...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Sign Document
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setShowDeclineForm(true)}
                  className="text-destructive hover:text-destructive"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Decline Document</CardTitle>
              <CardDescription>
                Please let us know why you're declining this document
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reason">Reason (optional)</Label>
                <Input
                  id="reason"
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  placeholder="Enter reason for declining"
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="destructive"
                  onClick={() => declineMutation.mutate()}
                  disabled={declineMutation.isPending}
                >
                  {declineMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Declining...
                    </>
                  ) : (
                    "Confirm Decline"
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowDeclineForm(false)}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
