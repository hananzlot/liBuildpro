import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calculator, Send, FileSignature, Plus } from "lucide-react";

type ViewType = "list" | "proposals" | "contracts";

export default function Estimates() {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentView = (searchParams.get("view") as ViewType) || "list";

  const handleViewChange = (view: string) => {
    setSearchParams({ view });
  };

  return (
    <AppLayout>
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Estimates & Contracts</h1>
            <p className="text-muted-foreground">
              Create estimates, send proposals, and manage contracts
            </p>
          </div>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New Estimate
          </Button>
        </div>

        <Tabs value={currentView} onValueChange={handleViewChange} className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="list" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Estimates
            </TabsTrigger>
            <TabsTrigger value="proposals" className="flex items-center gap-2">
              <Send className="h-4 w-4" />
              Proposals
            </TabsTrigger>
            <TabsTrigger value="contracts" className="flex items-center gap-2">
              <FileSignature className="h-4 w-4" />
              Contracts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>All Estimates</CardTitle>
                <CardDescription>
                  View and manage all estimates. Create new estimates or edit existing ones.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No Estimates Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Get started by creating your first estimate.
                  </p>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Estimate
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="proposals" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Proposals</CardTitle>
                <CardDescription>
                  Track proposals sent to clients. Monitor views, approvals, and client responses.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Send className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No Proposals Sent</h3>
                  <p className="text-muted-foreground">
                    Send an estimate as a proposal to see it here.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="contracts" className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Contracts</CardTitle>
                <CardDescription>
                  Manage signed contracts and pending signatures. View contract status and audit trails.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FileSignature className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold">No Contracts Yet</h3>
                  <p className="text-muted-foreground">
                    Contracts will appear here once proposals are approved and signed.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
