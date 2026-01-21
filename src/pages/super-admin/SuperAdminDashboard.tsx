import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, CreditCard, DollarSign, Activity, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import type { SubscriptionPlan, SubscriptionStatus } from "@/types/subscription";

export default function SuperAdminDashboard() {
  const navigate = useNavigate();

  // Fetch platform metrics
  const { data: metrics } = useQuery({
    queryKey: ["super-admin-metrics"],
    queryFn: async () => {
      // Fetch companies
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("id, is_active");
      if (companiesError) throw companiesError;

      // Fetch subscriptions with plans
      const { data: subscriptions, error: subsError } = await supabase
        .from("company_subscriptions")
        .select(`
          status,
          billing_cycle,
          plan:subscription_plans(price_monthly, price_yearly)
        `);
      if (subsError) throw subsError;

      // Fetch all users
      const { data: users, error: usersError } = await supabase
        .from("profiles")
        .select("id, company_id");
      if (usersError) throw usersError;

      // Calculate MRR
      const mrr = subscriptions?.reduce((sum, sub) => {
        if (sub.status === "active" && sub.plan) {
          const plan = sub.plan as unknown as SubscriptionPlan;
          const price = sub.billing_cycle === "yearly" 
            ? plan.price_yearly / 12 
            : plan.price_monthly;
          return sum + price;
        }
        return sum;
      }, 0) || 0;

      const statusCounts = subscriptions?.reduce((acc, sub) => {
        acc[sub.status as string] = (acc[sub.status as string] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return {
        totalCompanies: companies?.length || 0,
        activeCompanies: companies?.filter(c => c.is_active).length || 0,
        totalUsers: users?.length || 0,
        platformAdmins: users?.filter(u => !u.company_id).length || 0,
        activeSubscriptions: statusCounts["active"] || 0,
        trialSubscriptions: statusCounts["trialing"] || 0,
        pastDueSubscriptions: statusCounts["past_due"] || 0,
        mrr,
      };
    },
  });

  // Fetch recent companies
  const { data: recentCompanies } = useQuery({
    queryKey: ["super-admin-recent-companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select(`
          id, 
          name, 
          slug, 
          created_at,
          is_active
        `)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  return (
    <SuperAdminLayout 
      title="Platform Dashboard" 
      description="Overview of your SaaS platform"
    >
      <div className="space-y-6 p-6">
        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.totalCompanies || 0}</div>
              <p className="text-xs text-muted-foreground">
                {metrics?.activeCompanies || 0} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.totalUsers || 0}</div>
              <p className="text-xs text-muted-foreground">
                {metrics?.platformAdmins || 0} platform admins
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{metrics?.activeSubscriptions || 0}</div>
              <p className="text-xs text-muted-foreground">
                {metrics?.trialSubscriptions || 0} in trial
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${(metrics?.mrr || 0).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">MRR</p>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        {(metrics?.pastDueSubscriptions || 0) > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <CardTitle className="text-sm font-medium text-destructive">
                Attention Required
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">
                {metrics?.pastDueSubscriptions} subscription(s) are past due and require attention.
              </p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-2"
                onClick={() => navigate("/super-admin/tenants")}
              >
                View Subscriptions
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* Recent Companies */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Companies</CardTitle>
              <CardDescription>Latest companies added to the platform</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentCompanies?.map((company) => (
                  <div key={company.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{company.name}</p>
                      <p className="text-sm text-muted-foreground">{company.slug}</p>
                    </div>
                    <Badge variant={company.is_active ? "default" : "secondary"}>
                      {company.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                ))}
                {(!recentCompanies || recentCompanies.length === 0) && (
                  <p className="text-sm text-muted-foreground">No companies yet</p>
                )}
              </div>
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => navigate("/super-admin/tenants")}
              >
                View All Companies
              </Button>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common platform management tasks</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/super-admin/tenants")}
              >
                <Building2 className="h-4 w-4 mr-2" />
                Add New Company
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/super-admin/app-settings")}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Manage Default Settings
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/super-admin/plans")}
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Edit Subscription Plans
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate("/super-admin/admins")}
              >
                <Users className="h-4 w-4 mr-2" />
                Manage Platform Admins
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </SuperAdminLayout>
  );
}
