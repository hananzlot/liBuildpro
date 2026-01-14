import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, FileText, CheckCircle, XCircle, Download } from "lucide-react";
import { toast } from "sonner";
import { SignatureCanvas } from "@/components/portal/SignatureCanvas";

export default function DocumentPortal() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const queryClient = useQueryClient();

  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [signatureData, setSignatureData] = useState<{ type: "typed" | "drawn"; data: string; font?: string } | null>(null);
  const [declineReason, setDeclineReason] = useState("");
  const [showDeclineForm, setShowDeclineForm] = useState(false);

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

      // Update document viewed status if not already signed
      const doc = tokenData.signature_documents;
      if (doc && doc.status === "sent") {
        await supabase
          .from("signature_documents")
          .update({
            status: "viewed",
            viewed_at: new Date().toISOString(),
          })
          .eq("id", doc.id);
      }

      // Pre-fill signer info from document
      if (doc) {
        setSignerName(doc.recipient_name || "");
        setSignerEmail(doc.recipient_email || "");
      }

      return {
        token: tokenData,
        document: doc,
      };
    },
    enabled: !!token,
  });

  // Sign mutation
  const signMutation = useMutation({
    mutationFn: async () => {
      if (!data?.document) throw new Error("Document not found");
      if (!signerName) throw new Error("Please enter your name");
      if (!signatureData) throw new Error("Please provide your signature");

      // Save signature
      const { error: sigError } = await supabase.from("document_signatures").insert({
        document_id: data.document.id,
        signer_name: signerName,
        signer_email: signerEmail || null,
        signature_type: signatureData.type,
        signature_data: signatureData.data,
        signature_font: signatureData.font || null,
        ip_address: null,
        user_agent: navigator.userAgent,
      });

      if (sigError) throw sigError;

      // Update document status
      const { error: updateError } = await supabase
        .from("signature_documents")
        .update({
          status: "signed",
          signed_at: new Date().toISOString(),
        })
        .eq("id", data.document.id);

      if (updateError) throw updateError;

      // Notify admin
      await supabase.functions.invoke("send-proposal-notification", {
        body: {
          action: "document_signed",
          documentName: data.document.document_name,
          recipientName: signerName,
          recipientEmail: signerEmail,
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

      const { error } = await supabase
        .from("signature_documents")
        .update({
          status: "declined",
          declined_at: new Date().toISOString(),
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

  const handleSignatureComplete = (data: { type: "typed" | "drawn"; data: string; font?: string }) => {
    setSignatureData(data);
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

  // Already signed
  if (doc.status === "signed") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Document Signed</CardTitle>
            <CardDescription>
              Thank you! This document has been signed successfully.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={() => window.open(doc.document_url, "_blank")}>
              <Download className="mr-2 h-4 w-4" />
              Download Document
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Declined
  if (doc.status === "declined") {
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
            <div className="flex flex-wrap gap-4">
              <Button onClick={() => window.open(doc.document_url, "_blank")}>
                <Download className="mr-2 h-4 w-4" />
                View Document
              </Button>
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

              <div className="space-y-2">
                <Label>Your Signature</Label>
                <SignatureCanvas
                  onSignatureComplete={handleSignatureComplete}
                  signerName={signerName}
                />
              </div>

              {signatureData && (
                <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle className="h-4 w-4" />
                    <span className="font-medium">Signature captured</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-4">
                <Button
                  onClick={() => signMutation.mutate()}
                  disabled={signMutation.isPending || !signerName || !signatureData}
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
