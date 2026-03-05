import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function SalesPortalGuide() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const returnToken = searchParams.get("token");

  const handleBack = () => {
    if (returnToken) {
      navigate(`/salesperson-calendar/${returnToken}`);
    } else {
      navigate(-1);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-3 print:hidden">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Portal
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" />
            Print / Save PDF
          </Button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-10 print:py-4 print:space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-2">Sales Rep Portal — How-To Guide</h1>
          <p className="text-muted-foreground text-sm">
            Step-by-step instructions for creating estimates and change orders through the portal.
          </p>
        </div>

        {/* Section 1: Creating an Initial Estimate */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
            1. Creating an Initial Estimate
          </h2>

          <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
            <h3 className="font-semibold text-foreground">Option A — From a Calendar Appointment</h3>
            <ol className="list-decimal list-inside space-y-2 pl-2">
              <li>Tap <strong>Calendar</strong> on the home screen.</li>
              <li>Navigate to the appointment date and tap the appointment card.</li>
              <li>In the appointment detail sheet, scroll down to the <strong>"Create Estimate"</strong> section.</li>
              <li>The customer's name, contact info, and job address are pre-filled from the appointment.</li>
              <li>Enter the <strong>Scope of Work</strong> — describe what the customer needs done in detail.</li>
              <li>Choose your creation method:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li><strong>Prepare with AI</strong> — The system will generate line items, phases, and pricing automatically. You'll review and edit before sending.</li>
                  <li><strong>Prepare Manually</strong> — Enter the total price, estimated costs, and progress payments yourself (see Section 3 below).</li>
                </ul>
              </li>
              <li>Once created, the estimate appears in your <strong>Estimates</strong> tab.</li>
            </ol>

            <h3 className="font-semibold text-foreground mt-6">Option B — From Quick Create</h3>
            <ol className="list-decimal list-inside space-y-2 pl-2">
              <li>Tap <strong>Quick Create</strong> on the home screen.</li>
              <li>Select an existing <strong>Opportunity</strong> from the dropdown, or enter customer info manually.</li>
              <li>If the opportunity already has a project on file, the system will alert you and auto-link the estimate.</li>
              <li>Fill in the <strong>Job Address</strong> (include ZIP code for AI estimates) and <strong>Scope of Work</strong>.</li>
              <li>Choose <strong>Prepare with AI</strong> or <strong>Prepare Manually</strong>.</li>
            </ol>
          </div>
        </section>

        {/* Section 2: Creating a Change Order */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
            2. Creating a Change Order
          </h2>

          <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
            <p>
              A <strong>Change Order</strong> is automatically detected when the selected opportunity/project already has a signed contract on file. The system switches all labels to "Change Order" terminology for you.
            </p>

            <ol className="list-decimal list-inside space-y-2 pl-2">
              <li>Tap <strong>Quick Create</strong> on the home screen.</li>
              <li>Select the opportunity that already has a signed contract.</li>
              <li>The system detects the existing contract and changes the title to <strong>"Create Change Order"</strong>.</li>
              <li>Describe the <strong>additional work</strong> in the Scope of Work field.</li>
              <li>Choose your method:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li><strong>Prepare Change Order by AI</strong> — AI generates the change order scope and pricing.</li>
                  <li><strong>Prepare Change Order Manually</strong> — You enter the change order total and payment schedule.</li>
                </ul>
              </li>
              <li>Once submitted, the change order appears in your Estimates tab and can be sent as a proposal for customer signature.</li>
            </ol>
          </div>
        </section>

        {/* Section 3: Manual Estimate Entry */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
            3. Manual Estimate / Change Order Entry
          </h2>

          <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
            <p>When you choose <strong>"Prepare Manually"</strong>, a form appears with the following fields:</p>

            <ul className="list-disc list-inside space-y-2 pl-2">
              <li><strong>Estimate Total Price</strong> — The total contract amount the customer will pay.</li>
              <li><strong>Estimated Costs</strong> — Your anticipated cost for materials, labor, etc.</li>
              <li><strong>Progress Payments</strong> — Break the total into payment milestones:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                  <li>Enter a <strong>Phase Name</strong> (e.g., "Deposit", "Rough-In", "Completion") and <strong>Amount</strong> for each.</li>
                  <li>You can add up to 10 progress payments.</li>
                  <li>The running total is displayed — it must <strong>exactly match</strong> the Estimate Total Price before you can submit.</li>
                  <li>If the totals don't match, the submit button stays disabled and a warning appears.</li>
                </ul>
              </li>
            </ul>

            <div className="bg-accent/50 border border-border rounded-lg p-3 mt-3">
              <p className="text-muted-foreground font-medium text-xs">
                💡 Tip: Double-check that your progress payments add up to the total before submitting. The system will not let you proceed if they don't match.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Viewing & Sending Proposals */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
            4. Viewing & Sending Proposals
          </h2>

          <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
            <ol className="list-decimal list-inside space-y-2 pl-2">
              <li>Go to the <strong>Estimates</strong> tab on the home screen.</li>
              <li>Tap on the estimate you want to review.</li>
              <li>Review the details — scope, line items, total, and payment schedule.</li>
              <li>When ready, tap <strong>"Send as Proposal"</strong> to email the proposal to the customer.</li>
              <li>The customer receives a link to view, approve, and sign the proposal online.</li>
              <li>Once signed, the contract appears in your <strong>Contracts</strong> tab.</li>
            </ol>
          </div>
        </section>

        {/* Section 5: Viewing Signed Contracts */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
            5. Viewing Signed Contracts
          </h2>

          <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
            <ol className="list-decimal list-inside space-y-2 pl-2">
              <li>Tap <strong>Contracts</strong> on the home screen.</li>
              <li>Browse signed contracts — each shows the customer name, amount, and date signed.</li>
              <li>Tap a contract to view the signed PDF directly in the portal.</li>
            </ol>
          </div>
        </section>

        {/* Section 6: Uploading Files */}
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-foreground border-b border-border pb-2">
            6. Uploading Files to a Project
          </h2>

          <div className="space-y-3 text-sm text-foreground/90 leading-relaxed">
            <ol className="list-decimal list-inside space-y-2 pl-2">
              <li>From <strong>Quick Create</strong>, scroll down to the <strong>File Upload</strong> section.</li>
              <li>Select the project you want to upload files to.</li>
              <li>Tap <strong>Upload</strong> and choose photos or documents from your device.</li>
              <li>Add an optional note describing the files.</li>
              <li>Files are attached to the project and visible to the office team immediately.</li>
            </ol>
          </div>
        </section>

        {/* Footer */}
        <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground print:pt-4">
          <p>Need help? Contact your office administrator for support.</p>
        </div>
      </main>
    </div>
  );
}
