import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { PlatformUsersSection } from "@/components/subscription/PlatformUsersSection";

export default function PlatformAdmins() {
  return (
    <SuperAdminLayout 
      title="Platform Admins" 
      description="Manage super admin users who can access all companies"
    >
      <div className="p-6">
        <PlatformUsersSection />
      </div>
    </SuperAdminLayout>
  );
}
