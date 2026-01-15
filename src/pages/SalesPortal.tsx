import { ExternalLink, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const SalesPortal = () => {
  const { profile, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8 text-center">
        {/* Branding */}
        <div className="space-y-4">
          <div className="mx-auto h-20 w-20 rounded-2xl bg-primary text-primary-foreground font-bold text-3xl flex items-center justify-center shadow-lg">
            CA
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">CA Pro Builders</h1>
            <p className="text-muted-foreground mt-2">Sales Portal</p>
          </div>
        </div>

        {/* Welcome */}
        <p className="text-lg text-muted-foreground">
          Welcome back, <span className="font-medium text-foreground">{profile?.full_name || 'Sales Team Member'}</span>
        </p>

        {/* Palisades Link Card */}
        <Card className="border-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Access Your Sales Tools</CardTitle>
            <CardDescription>
              Click below to open the Palisades sales platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild size="lg" className="w-full text-lg h-14">
              <a 
                href="https://palisades.ca-probuilders.com" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                Open Palisades
                <ExternalLink className="ml-2 h-5 w-5" />
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Logout */}
        <Button 
          variant="ghost" 
          onClick={signOut}
          className="text-muted-foreground hover:text-foreground"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};

export default SalesPortal;
