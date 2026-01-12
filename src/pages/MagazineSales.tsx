import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MagazineSalesTab } from "@/components/dashboard/MagazineSalesTab";
import { AppLayout } from "@/components/layout/AppLayout";

const MagazineSales = () => {
  const navigate = useNavigate();
  const { isAdmin, isSimulating } = useAuth();

  const handleAdminAction = (action: string) => {
    switch (action) {
      case 'audit':
        navigate('/audit-log');
        break;
    }
  };

  return (
    <AppLayout onAdminAction={(isAdmin || isSimulating) ? handleAdminAction : undefined}>
      <div className="px-6 py-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground mb-1">Magazine Sales</h2>
          <p className="text-sm text-muted-foreground">Track magazine ad sales and revenue</p>
        </div>
        
        <MagazineSalesTab />
      </div>
    </AppLayout>
  );
};

export default MagazineSales;
