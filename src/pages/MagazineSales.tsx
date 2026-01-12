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
      <div className="px-6 py-6">
        <MagazineSalesTab />
      </div>
    </AppLayout>
  );
};

export default MagazineSales;
