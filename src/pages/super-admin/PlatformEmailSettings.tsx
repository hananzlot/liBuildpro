import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { PlatformEmailSettings as EmailSettingsComponent } from "@/components/admin/PlatformEmailSettings";

export default function PlatformEmailSettingsPage() {
  return (
    <SuperAdminLayout 
      title="Platform Email Settings" 
      description="Configure email delivery for the entire platform"
    >
      <div className="p-6">
        <EmailSettingsComponent />
      </div>
    </SuperAdminLayout>
  );
}
