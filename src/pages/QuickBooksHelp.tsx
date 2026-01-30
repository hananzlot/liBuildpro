import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, ExternalLink, Settings, Link2, RefreshCw } from "lucide-react";

export default function QuickBooksHelp() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold tracking-tight mb-4">
            Connect QuickBooks Online
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Sync your invoices, payments, and bills automatically with QuickBooks Online
          </p>
        </div>

        <div className="space-y-8">
          {/* Prerequisites */}
          <Card>
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

          {/* Step by Step */}
          <Card>
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
          <Card>
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

          {/* Switching Companies */}
          <Card>
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
          <Card>
            <CardHeader>
              <CardTitle>Troubleshooting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-1">Connection expired or disconnected?</h4>
                <p className="text-sm text-muted-foreground">
                  QuickBooks connections can expire after extended periods of inactivity. Simply click "Connect to QuickBooks" again to re-authorize.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Sync errors?</h4>
                <p className="text-sm text-muted-foreground">
                  Check that your account mappings are correctly configured. Missing mappings for accounts or items can cause sync failures.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-1">Connected to the wrong company?</h4>
                <p className="text-sm text-muted-foreground">
                  Use the "Switch Company" button to disconnect and reconnect to a different QuickBooks company.
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
