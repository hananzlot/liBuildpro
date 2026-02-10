import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCompanyContext } from "@/hooks/useCompanyContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LayoutDashboard, 
  FolderKanban, 
  Calculator, 
  Building2,
  Settings,
  ArrowRight
} from "lucide-react";

const Home = () => {
  const navigate = useNavigate();
  const { 
    company, 
    isAdmin, 
    isDispatch, 
    isProduction, 
    isMagazine, 
    isContractManager, 
    isSuperAdmin,
    canUseFeature
  } = useAuth();
  const { companyId } = useCompanyContext();

  // Super admin prompt to select a company if none selected
  if (isSuperAdmin && !companyId) {
    return (
      <AppLayout>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4 p-8">
            <h2 className="text-2xl font-semibold text-foreground">Select a Company</h2>
            <p className="text-muted-foreground max-w-md">
              As a Super Admin, please use the company switcher in the sidebar to select which company you want to work on.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const quickAccessItems = [
    {
      title: "Dispatch Dashboard",
      description: "View opportunities, appointments, and lead metrics",
      icon: LayoutDashboard,
      path: "/dashboard",
      visible: (isAdmin || isDispatch || isSuperAdmin) && canUseFeature('dashboard'),
      color: "bg-blue-500/10 text-blue-600 dark:text-blue-400"
    },
    {
      title: "Production",
      description: "Manage projects, analytics, and subcontractors",
      icon: FolderKanban,
      path: "/production",
      visible: (isAdmin || isProduction || isSuperAdmin) && canUseFeature('production'),
      color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
    },
    {
      title: "Estimates & Contracts",
      description: "Create estimates, proposals, and contracts",
      icon: Calculator,
      path: "/estimates",
      visible: (isAdmin || isContractManager || isSuperAdmin) && canUseFeature('estimates'),
      color: "bg-purple-500/10 text-purple-600 dark:text-purple-400"
    },
    {
      title: "Admin Settings",
      description: "Manage integrations, users, and company settings",
      icon: Settings,
      path: "/admin",
      visible: isAdmin && !isSuperAdmin,
      color: "bg-amber-500/10 text-amber-600 dark:text-amber-400"
    },
    {
      title: "Super Admin Portal",
      description: "Manage tenants and platform settings",
      icon: Building2,
      path: "/super-admin",
      visible: isSuperAdmin,
      color: "bg-rose-500/10 text-rose-600 dark:text-rose-400"
    },
  ];

  const visibleItems = quickAccessItems.filter(item => item.visible);

  return (
    <AppLayout>
      <div className="flex-1 flex flex-col items-center justify-center p-8">
        <div className="max-w-4xl w-full space-y-8">
          {/* Welcome Header */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              Welcome to {company?.name || "Your Company"}
            </h1>
            <p className="text-lg text-muted-foreground">
              Select where you'd like to go
            </p>
          </div>

          {/* Quick Access Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleItems.map((item) => (
              <Card 
                key={item.path}
                className="group cursor-pointer transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
                onClick={() => navigate(item.path)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-3 ${item.color}`}>
                      <item.icon className="h-5 w-5" />
                    </div>
                    <CardTitle className="text-lg">{item.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription className="flex items-center justify-between">
                    <span>{item.description}</span>
                    <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-200" />
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Fallback for users with no visible items */}
          {visibleItems.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                No modules are available for your current role. Please contact an administrator.
              </p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Home;
