import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ExternalLink, Settings, Link2, RefreshCw, Filter, Calendar, Ban, Eye, HelpCircle } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const sections = [
  { id: "prerequisites", label: "Before You Start" },
  { id: "connection-guide", label: "Connection Guide" },
  { id: "what-syncs", label: "What Gets Synced" },
  { id: "sync-controls", label: "Sync Controls" },
  { id: "switching-companies", label: "Switching Companies" },
  { id: "troubleshooting", label: "Troubleshooting" },
  { id: "faq", label: "FAQ" },
];

export default function QuickBooksHelp() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            QuickBooks Online Integration
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Sync your invoices, payments, and bills automatically with QuickBooks Online
          </p>
        </div>

        {/* Table of Contents */}
        <Card className="mb-8">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Quick Navigation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => scrollToSection(section.id)}
                  className="px-3 py-1.5 text-sm rounded-full bg-muted hover:bg-primary hover:text-primary-foreground transition-colors"
                >
                  {section.label}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          {/* Prerequisites */}
          <Card id="prerequisites">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                Before You Start
              </CardTitle>
              <CardDescription>
                Make sure you have the following ready
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm font-medium text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium">QuickBooks Online Account</p>
                    <p className="text-sm text-muted-foreground">
                      You need an active QuickBooks Online subscription (Simple Start, Essentials, Plus, or Advanced)
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm font-medium text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Admin Access</p>
                    <p className="text-sm text-muted-foreground">
                      You must have admin privileges in both your company account here and in QuickBooks
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm font-medium text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Know Your QuickBooks Company</p>
                    <p className="text-sm text-muted-foreground">
                      If you have multiple QuickBooks companies, know which one you want to connect
                    </p>
                  </div>
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Step by Step Connection */}
          <Card id="connection-guide">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Step-by-Step Connection Guide
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-bold">
                    1
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Go to Admin Settings</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Navigate to <strong>Admin Settings</strong> from the sidebar menu, then select the <strong>Integrations</strong> tab.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-bold">
                    2
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Click "Connect to QuickBooks"</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Find the QuickBooks Online card and click the <strong>Connect to QuickBooks</strong> button.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-bold">
                    3
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Sign In to Intuit</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      A new window will open asking you to sign in to your Intuit/QuickBooks account. Enter your credentials.
                    </p>
                    <div className="bg-muted/50 rounded-lg p-3 text-sm">
                      <strong>Tip:</strong> If you have multiple QuickBooks companies, make sure you're signed into the correct one before connecting.
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-bold">
                    4
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Authorize the Connection</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Review the permissions requested and click <strong>Connect</strong> to authorize the integration.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 font-bold">
                    5
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">Configure Mappings</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      Once connected, configure how your accounts, items, and payment methods map to QuickBooks. This ensures data syncs correctly.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* What Syncs */}
          <Card id="what-syncs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5 text-primary" />
                What Gets Synced
              </CardTitle>
              <CardDescription>
                Data automatically syncs when created or updated
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2">Invoices</h4>
                  <p className="text-sm text-muted-foreground">
                    Customer invoices are created in QuickBooks with matching line items and amounts.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2">Payments</h4>
                  <p className="text-sm text-muted-foreground">
                    Customer payments are recorded against their invoices in QuickBooks.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2">Bills</h4>
                  <p className="text-sm text-muted-foreground">
                    Subcontractor and vendor bills are synced to track payables.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sync Controls - NEW SECTION */}
          <Card id="sync-controls">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-primary" />
                Sync Controls
              </CardTitle>
              <CardDescription>
                Fine-grained control over what gets synced to QuickBooks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Transaction Picker */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">Transaction Picker</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  When you click <strong>Sync Now</strong>, a dialog opens showing all pending invoices, payments, and bills. You can:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                  <li>Select individual transactions to sync</li>
                  <li>Use "Select All" to sync everything at once</li>
                  <li>Preview exactly what will be synced before confirming</li>
                </ul>
              </div>

              <Separator />

              {/* Date Range Filter */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">Date Range Filter</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Filter transactions by date range to sync only records from a specific period:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                  <li>Default range: from last sync date to today</li>
                  <li>Customize the start and end dates as needed</li>
                  <li>Useful for catching up on older transactions or limiting sync scope</li>
                </ul>
              </div>

              <Separator />

              {/* Exclude from QB */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Ban className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">Exclude from QuickBooks</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Mark specific transactions to be permanently excluded from QuickBooks syncing:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                  <li>Click the exclude icon next to any transaction in the sync dialog</li>
                  <li>Excluded transactions won't appear in future sync lists</li>
                  <li>Useful for internal adjustments, test entries, or items managed manually in QuickBooks</li>
                </ul>
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <strong>Note:</strong> You can also exclude transactions directly from the project finance section.
                </div>
              </div>

              <Separator />

              {/* Sync Preview */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">Sync Preview</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Before executing any sync, you'll see a complete preview of all selected transactions with:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                  <li>Transaction type (Invoice, Payment, or Bill)</li>
                  <li>Associated project name</li>
                  <li>Amount and date</li>
                  <li>Total count and value of what will be synced</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Switching Companies */}
          <Card id="switching-companies">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5 text-primary" />
                Switching QuickBooks Companies
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                If you need to connect a different QuickBooks company:
              </p>
              <ol className="list-decimal list-inside space-y-2 text-sm">
                <li>Go to Admin Settings → Integrations</li>
                <li>Click the <strong>Switch Company</strong> button next to your current connection</li>
                <li>Sign in to QuickBooks and select the new company you want to use</li>
                <li>Re-configure your account mappings for the new company</li>
              </ol>
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <strong>Note:</strong> If you're already signed into QuickBooks with multiple companies, you may need to first go to{" "}
                <a href="https://qbo.intuit.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                  qbo.intuit.com <ExternalLink className="h-3 w-3" />
                </a>{" "}
                and switch companies there before reconnecting.
              </div>
            </CardContent>
          </Card>

          {/* Troubleshooting */}
          <Card id="troubleshooting">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                Troubleshooting
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-1">Connection expired or disconnected?</h4>
                <p className="text-sm text-muted-foreground">
                  QuickBooks connections can expire after extended periods of inactivity. Simply click "Connect to QuickBooks" again to re-authorize.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Sync errors?</h4>
                <p className="text-sm text-muted-foreground">
                  Check that your account mappings are correctly configured. Missing mappings for accounts or items can cause sync failures.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Connected to the wrong company?</h4>
                <p className="text-sm text-muted-foreground">
                  Use the "Switch Company" button to disconnect and reconnect to a different QuickBooks company.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Transactions not appearing in sync list?</h4>
                <p className="text-sm text-muted-foreground">
                  Check if the transaction has been marked as "Exclude from QB" or if it falls outside your selected date range. Already-synced transactions also won't appear.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* FAQ - NEW SECTION */}
          <Card id="faq">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5 text-primary" />
                Frequently Asked Questions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-1">How do I sync historical transactions?</h4>
                <p className="text-sm text-muted-foreground">
                  Use the date range filter in the Sync dialog to select an earlier start date. All unsynced transactions within that range will appear for selection.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Can I undo an exclusion?</h4>
                <p className="text-sm text-muted-foreground">
                  Yes, you can remove the "Exclude from QB" flag from the project's finance section. The transaction will then appear in the next sync.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">What happens if I sync the same transaction twice?</h4>
                <p className="text-sm text-muted-foreground">
                  The system tracks which transactions have been synced. Already-synced transactions won't appear in the sync list and won't create duplicates in QuickBooks.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Do I need to map every account?</h4>
                <p className="text-sm text-muted-foreground">
                  You should map at least your primary income account, expense account, and payment methods. Unmapped items may cause sync failures or use default accounts.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">How often does automatic syncing occur?</h4>
                <p className="text-sm text-muted-foreground">
                  Transactions sync automatically when created or updated. You can also trigger a manual sync at any time using the "Sync Now" button.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Footer */}
          <div className="text-center text-sm text-muted-foreground pt-8">
            <p>
              Need more help? Contact your administrator or reach out to support.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
