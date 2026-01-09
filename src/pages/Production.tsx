import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { 
  ArrowLeft, 
  Building2, 
  Search, 
  Plus, 
  Filter,
  ChevronDown,
  User,
  Key,
  LogOut
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ProjectDetailSheet } from "@/components/production/ProjectDetailSheet";

interface Project {
  id: string;
  project_number: number;
  project_name: string;
  project_status: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  cell_phone: string | null;
  project_address: string | null;
  primary_salesperson: string | null;
  estimated_cost: number | null;
  total_pl: number | null;
  created_at: string;
  opportunity_id: string | null;
  location_id: string;
}

const statusColors: Record<string, string> = {
  "New Job": "bg-blue-500/10 text-blue-500 border-blue-500/20",
  "In-Progress": "bg-amber-500/10 text-amber-500 border-amber-500/20",
  "On-Hold": "bg-orange-500/10 text-orange-500 border-orange-500/20",
  "Completed": "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  "Cancelled": "bg-red-500/10 text-red-500 border-red-500/20",
};

export default function Production() {
  const { user, profile, signOut, updatePassword } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const { data: projects = [], isLoading, refetch } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Project[];
    },
  });

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      searchQuery === "" ||
      project.project_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.customer_first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.customer_last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      project.project_number?.toString().includes(searchQuery);

    const matchesStatus =
      statusFilter === "all" || project.project_status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const formatCurrency = (value: number | null) => {
    if (value === null) return "-";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleLogout = async () => {
    await signOut();
    toast.success("Signed out successfully");
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords don't match");
      return;
    }
    setIsChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) {
        toast.error(error.message);
      } else {
        toast.success("Password updated successfully");
        setChangePasswordOpen(false);
        setNewPassword("");
        setConfirmPassword("");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleOpenProject = (project: Project) => {
    setSelectedProject(project);
    setDetailSheetOpen(true);
  };

  // Calculate KPIs
  const totalProjects = projects.length;
  const inProgressProjects = projects.filter(p => p.project_status === "In-Progress").length;
  const completedProjects = projects.filter(p => p.project_status === "Completed").length;
  const totalEstimatedCost = projects.reduce((sum, p) => sum + (p.estimated_cost || 0), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="px-8 py-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                <Building2 className="h-6 w-6" />
                Production
              </h1>
              <p className="text-sm text-muted-foreground">Project Management</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="hidden sm:inline">{profile?.full_name || user?.email}</span>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                  <Key className="h-4 w-4 mr-2" />
                  Change Password
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <main className="px-8 py-6 space-y-6">
        {/* KPI Cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Projects</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalProjects}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-amber-500">{inProgressProjects}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Completed</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-500">{completedProjects}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Est. Cost</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{formatCurrency(totalEstimatedCost)}</p>
            </CardContent>
          </Card>
        </section>

        {/* Filters & Search */}
        <section className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="New Job">New Job</SelectItem>
                <SelectItem value="In-Progress">In-Progress</SelectItem>
                <SelectItem value="On-Hold">On-Hold</SelectItem>
                <SelectItem value="Completed">Completed</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button disabled>
            <Plus className="h-4 w-4 mr-2" />
            Add Project
          </Button>
        </section>

        {/* Projects Table */}
        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>
              {filteredProjects.length} project{filteredProjects.length !== 1 ? "s" : ""} found
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredProjects.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No projects found</p>
                <p className="text-sm">Projects will appear here when opportunities are marked as won</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-20">#</TableHead>
                    <TableHead>Project Name</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Salesperson</TableHead>
                    <TableHead className="text-right">Est. Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProjects.map((project) => (
                    <TableRow 
                      key={project.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleOpenProject(project)}
                    >
                      <TableCell className="font-medium">{project.project_number}</TableCell>
                      <TableCell className="font-medium">{project.project_name}</TableCell>
                      <TableCell>
                        {project.customer_first_name || project.customer_last_name
                          ? `${project.customer_first_name || ""} ${project.customer_last_name || ""}`.trim()
                          : "-"}
                      </TableCell>
                      <TableCell>{project.cell_phone || "-"}</TableCell>
                      <TableCell>
                        <Badge 
                          variant="outline" 
                          className={statusColors[project.project_status || "New Job"] || ""}
                        >
                          {project.project_status || "New Job"}
                        </Badge>
                      </TableCell>
                      <TableCell>{project.primary_salesperson || "-"}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(project.estimated_cost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Project Detail Sheet */}
      <ProjectDetailSheet
        project={selectedProject}
        open={detailSheetOpen}
        onOpenChange={setDetailSheetOpen}
        onUpdate={refetch}
      />

      {/* Change Password Dialog */}
      <Dialog open={changePasswordOpen} onOpenChange={setChangePasswordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your new password below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">New Password</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePasswordOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword ? "Updating..." : "Update Password"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
