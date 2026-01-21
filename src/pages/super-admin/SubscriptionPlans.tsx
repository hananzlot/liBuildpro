import { SuperAdminLayout } from "@/components/layout/SuperAdminLayout";
import { PlansEditorSection } from "@/components/subscription/PlansEditorSection";

export default function SubscriptionPlans() {
  return (
    <SuperAdminLayout 
      title="Subscription Plans" 
      description="Manage pricing tiers and features for your SaaS"
    >
      <div className="p-6">
        <PlansEditorSection />
      </div>
    </SuperAdminLayout>
  );
}
