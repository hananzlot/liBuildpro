import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ExternalLink, Settings, Link2, RefreshCw, Filter, Calendar, Ban, Eye, HelpCircle, Users, Trash2, MapPin, FileText, DollarSign, Building2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

const sections = [
  { id: "prerequisites", label: "Before You Start" },
  { id: "connection-guide", label: "Connection Guide" },
  { id: "what-syncs", label: "What Gets Synced" },
  { id: "mappings", label: "Account & Entity Mappings" },
  { id: "bank-accounts", label: "Bank Account Mappings" },
  { id: "vendor-matching", label: "Vendor Matching" },
  { id: "commission-payments", label: "Commission Payments" },
  { id: "sync-controls", label: "Sync Controls" },
  { id: "deletions", label: "Deletions & Voids" },
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
            Sync your invoices, payments, bills, and bill payments automatically with QuickBooks Online
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
                      Once connected, configure how your accounts, customers, vendors, items, and payment methods map to QuickBooks. This ensures data syncs correctly.
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
                Data automatically syncs when created, updated, or deleted
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2">Invoices</h4>
                  <p className="text-sm text-muted-foreground">
                    Customer invoices are created in QuickBooks with matching line items, amounts, and customer references.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2">Payments (Collections)</h4>
                  <p className="text-sm text-muted-foreground">
                    Customer payments are recorded against their invoices in QuickBooks, including payment method and deposit account.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2">Bills</h4>
                  <p className="text-sm text-muted-foreground">
                    Subcontractor and vendor bills are synced to QuickBooks with vendor matching and expense account categorization.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50">
                  <h4 className="font-semibold mb-2">Bill Payments</h4>
                  <p className="text-sm text-muted-foreground">
                    Payments made to vendors are recorded against their bills in QuickBooks, tracking your accounts payable.
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted/50 md:col-span-2">
                  <h4 className="font-semibold mb-2 flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    Commission Payments
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Salesperson commission payments are synced as Check (Purchase) transactions in QuickBooks. They're linked to the project's customer for accurate job costing and assigned to the mapped vendor (salesperson).
                  </p>
                </div>
              </div>
              <div className="mt-4 bg-primary/5 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Deletions & Voids Sync Too
                </h4>
                <p className="text-sm text-muted-foreground">
                  When you delete or void a financial record locally, it's automatically voided or deleted in QuickBooks as well, keeping both systems in sync.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Account & Entity Mappings */}
          <Card id="mappings">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                Account & Entity Mappings
              </CardTitle>
              <CardDescription>
                Configure how your data maps to QuickBooks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* GL Account Mappings */}
              <div className="space-y-3">
                <h4 className="font-semibold">General Ledger Accounts</h4>
                <p className="text-sm text-muted-foreground">
                  Map your income, expense, and liability accounts to ensure transactions post to the correct accounts in QuickBooks:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                  <li><strong>Income Account</strong> — Where invoice revenue is recorded</li>
                  <li><strong>Expense Account</strong> — Default account for bills and expenses</li>
                  <li><strong>Unearned Revenue (Deposits)</strong> — For customer deposits before work is completed</li>
                  <li><strong>Deposit Account</strong> — Bank account where payments are deposited</li>
                </ul>
              </div>

              <Separator />

              {/* Customer Mappings */}
              <div className="space-y-3">
                <h4 className="font-semibold">Customer Mappings</h4>
                <p className="text-sm text-muted-foreground">
                  Link your contacts to existing QuickBooks customers, or let the system create them automatically during sync:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                  <li>Search and match existing QuickBooks customers</li>
                  <li>Unmapped contacts show "Not in QB" indicator</li>
                  <li>Auto-creation option available during sync</li>
                </ul>
              </div>

              <Separator />

              {/* Vendor Mappings */}
              <div className="space-y-3">
                <h4 className="font-semibold">Vendor Mappings</h4>
                <p className="text-sm text-muted-foreground">
                  Map your subcontractors to QuickBooks vendors for accurate bill tracking:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                  <li>Search existing QuickBooks vendors by name</li>
                  <li>Mark vendors for auto-creation on next sync</li>
                  <li>Unmapped vendors show a "Not in QB" badge when creating bills</li>
                </ul>
              </div>

              <Separator />

              {/* Field-Level Mappings */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold">Field-Level Mappings</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Configure how individual fields map between systems for fine-grained control:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                  <li><strong>Invoice Fields</strong> — Invoice number, amounts, line items, memo</li>
                  <li><strong>Payment Fields</strong> — Payment reference, amount, date, method</li>
                  <li><strong>Bill Fields</strong> — Bill number, vendor, amount, due date</li>
                  <li><strong>Bill Payment Fields</strong> — Payment reference, amount, bank account</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Bank Account Mappings */}
          <Card id="bank-accounts">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Bank Account Mappings
              </CardTitle>
              <CardDescription>
                Link your local banks to QuickBooks bank accounts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Map your company's bank accounts to their corresponding QuickBooks bank accounts. This ensures payments and checks are posted to the correct accounts:
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm font-medium text-primary">1</span>
                  </div>
                  <div>
                    <p className="font-medium">Add Banks in Admin Settings</p>
                    <p className="text-sm text-muted-foreground">
                      First, create your company's bank accounts in Admin Settings → General → Bank Management.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm font-medium text-primary">2</span>
                  </div>
                  <div>
                    <p className="font-medium">Map to QuickBooks Accounts</p>
                    <p className="text-sm text-muted-foreground">
                      In QuickBooks Mappings, go to the Bank Accounts section and link each local bank to a QuickBooks bank account.
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-sm font-medium text-primary">3</span>
                  </div>
                  <div>
                    <p className="font-medium">Select Bank When Recording Payments</p>
                    <p className="text-sm text-muted-foreground">
                      When recording bill payments or commission payments, select the bank account. The corresponding QuickBooks account will be used for the transaction.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <strong>Important:</strong> Commission payments require a mapped bank account. If no bank is selected or mapped, you'll see an error during sync.
              </div>
            </CardContent>
          </Card>

          {/* Vendor Matching */}
          <Card id="vendor-matching">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Vendor Matching
              </CardTitle>
              <CardDescription>
                Handle unmapped vendors when creating bills
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                When you create a bill for a subcontractor that isn't mapped to a QuickBooks vendor, you'll be prompted to resolve the mapping:
              </p>
              
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border">
                  <h4 className="font-semibold mb-2">Search & Match</h4>
                  <p className="text-sm text-muted-foreground">
                    Search for an existing vendor in QuickBooks by name. If found, the system creates a permanent mapping for future use.
                  </p>
                </div>
                <div className="p-4 rounded-lg border border-border">
                  <h4 className="font-semibold mb-2">Mark for Creation</h4>
                  <p className="text-sm text-muted-foreground">
                    If the vendor doesn't exist in QuickBooks, mark them to be automatically created during the next sync.
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <strong>Visual Indicator:</strong> Subcontractors without a QuickBooks mapping show a "Not in QB" badge in the vendor dropdown when creating bills.
              </div>
            </CardContent>
          </Card>

          {/* Commission Payments */}
          <Card id="commission-payments">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Commission Payments
              </CardTitle>
              <CardDescription>
                Track salesperson commissions in QuickBooks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Commission payments to salespeople are synced to QuickBooks as Check (Purchase) transactions. This allows you to track commissions as expenses while linking them to specific projects for accurate job costing.
              </p>
              
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">How It Works</h4>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                    <li>Commission payments are recorded via the project's Finance tab → Commissions section</li>
                    <li>Each payment is linked to a salesperson and the project</li>
                    <li>When synced, a Check transaction is created in QuickBooks</li>
                    <li>The expense is categorized using your mapped expense account</li>
                    <li>The payment is linked to the project's customer for job costing reports</li>
                  </ul>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-2">Required Mappings</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Before syncing commission payments, ensure you have configured:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                    <li><strong>Salesperson → Vendor Mapping</strong> — Link salespeople to QuickBooks vendors</li>
                    <li><strong>Expense Account</strong> — The account where commission expenses are posted</li>
                    <li><strong>Bank Account</strong> — The bank account from which the payment is made</li>
                  </ul>
                </div>

                <Separator />

                <div>
                  <h4 className="font-semibold mb-2">Salesperson to Vendor Mapping</h4>
                  <p className="text-sm text-muted-foreground mb-2">
                    Each salesperson must be mapped to a QuickBooks vendor before their commission payments can sync:
                  </p>
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-4">
                    <li>Go to Admin Settings → Integrations → QuickBooks Mappings</li>
                    <li>Find the Salesperson/Vendor Mappings section</li>
                    <li>Search for existing vendors or mark for auto-creation</li>
                    <li>Unmapped salespeople show a "Not in QB" indicator</li>
                  </ul>
                </div>
              </div>

              <div className="bg-primary/5 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Customer Linking for Job Costing</h4>
                <p className="text-sm text-muted-foreground">
                  Commission payments are automatically linked to the project's customer in QuickBooks. This means commission expenses will appear in job profitability reports, giving you a complete picture of project costs including sales commissions.
                </p>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <strong>Note:</strong> Commission payment deletions also sync to QuickBooks—the corresponding Check transaction will be deleted automatically.
              </div>
            </CardContent>
          </Card>

          {/* Sync Controls */}
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
                  When you click <strong>Sync Now</strong>, a dialog opens showing all pending invoices, payments, bills, and bill payments. You can:
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
                  <li>Transaction type (Invoice, Payment, Bill, or Bill Payment)</li>
                  <li>Associated project name</li>
                  <li>Amount and date</li>
                  <li>Total count and value of what will be synced</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Deletions & Voids */}
          <Card id="deletions">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-primary" />
                Deletions & Voids
              </CardTitle>
              <CardDescription>
                Keep QuickBooks in sync when you remove or void records
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                When you delete or void a financial record that was previously synced to QuickBooks, the system automatically updates QuickBooks:
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium">Voiding Records</p>
                    <p className="text-sm text-muted-foreground">
                      When you void an invoice, payment, bill, or bill payment locally, it's automatically voided in QuickBooks. This preserves the audit trail in both systems.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Ban className="h-3 w-3 text-destructive" />
                  </div>
                  <div>
                    <p className="font-medium">Deleting Records</p>
                    <p className="text-sm text-muted-foreground">
                      When you delete a record, the corresponding QuickBooks entry is voided or deleted (depending on the record type). The sync log is updated to reflect the change.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <strong>Note:</strong> If QuickBooks is disconnected when you delete a record, it will be marked as "deleted locally" in the sync log. Reconnecting won't automatically delete it from QuickBooks—you may need to handle it manually.
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
                <li>Re-configure your account and entity mappings for the new company</li>
              </ol>
              <div className="bg-muted/50 rounded-lg p-3 text-sm">
                <strong>Note:</strong> The system will force a new company selection screen. If you're already signed into QuickBooks with multiple companies, you may need to first go to{" "}
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
                  QuickBooks connections can expire after extended periods of inactivity. Simply click "Connect to QuickBooks" again to re-authorize. The system will automatically attempt to refresh tokens before prompting for reconnection.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Sync errors?</h4>
                <p className="text-sm text-muted-foreground">
                  Check that your account and entity mappings are correctly configured. Missing mappings for accounts, customers, or vendors can cause sync failures. Look for "Not in QB" badges on records.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Connected to the wrong company?</h4>
                <p className="text-sm text-muted-foreground">
                  Use the "Switch Company" button to disconnect and reconnect to a different QuickBooks company. The system displays the connected company name so you can verify you're connected to the right one.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Transactions not appearing in sync list?</h4>
                <p className="text-sm text-muted-foreground">
                  Check if the transaction has been marked as "Exclude from QB" or if it falls outside your selected date range. Already-synced transactions also won't appear in the sync list.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Vendor not found when creating a bill?</h4>
                <p className="text-sm text-muted-foreground">
                  If a subcontractor shows "Not in QB", use the vendor matching dialog to search for an existing QuickBooks vendor or mark them for auto-creation on the next sync.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Sandbox vs Production environment?</h4>
                <p className="text-sm text-muted-foreground">
                  The system automatically detects and handles both sandbox and production QuickBooks environments. If you're using a sandbox account for testing, it will work seamlessly.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* FAQ */}
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
                  The system tracks which transactions have been synced in the sync log. Already-synced transactions won't appear in the sync list and won't create duplicates in QuickBooks.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Do I need to map every account and vendor?</h4>
                <p className="text-sm text-muted-foreground">
                  You should map at least your primary income account, expense account, and payment methods. For vendors, you can map them as needed or use the "Mark for Creation" option when creating bills.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">What happens when I delete a synced record?</h4>
                <p className="text-sm text-muted-foreground">
                  The system automatically voids or deletes the corresponding record in QuickBooks. If QuickBooks is disconnected, the record is marked for manual cleanup.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">How do bill payments sync?</h4>
                <p className="text-sm text-muted-foreground">
                  Bill payments are synced as BillPayment transactions in QuickBooks, linked to their corresponding bills. The payment method and bank account are included based on your mappings.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Can I connect to a QuickBooks sandbox?</h4>
                <p className="text-sm text-muted-foreground">
                  Yes, the system supports both sandbox and production QuickBooks environments. It automatically detects which environment you're connected to and routes API calls accordingly.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">How do commission payments sync?</h4>
                <p className="text-sm text-muted-foreground">
                  Commission payments are synced as Check (Purchase) transactions in QuickBooks. They're linked to the salesperson as the vendor and to the project's customer for job costing. Make sure you have mapped the salesperson to a vendor and configured a bank account.
                </p>
              </div>
              <Separator />
              <div>
                <h4 className="font-semibold mb-1">Why is my commission payment failing to sync?</h4>
                <p className="text-sm text-muted-foreground">
                  Commission payments require: (1) the salesperson mapped to a QuickBooks vendor, (2) a bank account selected on the payment and mapped in QuickBooks settings, and (3) an expense account configured. Check these mappings if you see sync errors.
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
