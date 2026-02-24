import { SlideLayout } from "../SlideLayout";
import { Rocket, Check } from "lucide-react";

const TIERS = [
  { name: "Starter", features: ["Dashboard", "Lead Tracking", "Basic Estimates", "Client Portal"] },
  { name: "Professional", features: ["Everything in Starter", "Production Management", "Document Signing", "Financial Analytics", "Sales Portal"] },
  { name: "Enterprise", features: ["Everything in Pro", "Multi-Location", "QuickBooks Sync", "Super-Admin Panel", "Custom Integrations", "Priority Support"] },
];

export default function SlideCTA() {
  return (
    <SlideLayout className="bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-950 text-white">
      <div className="flex flex-col items-center justify-center h-full px-32 py-20">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-8 shadow-xl shadow-indigo-500/30">
          <Rocket className="w-8 h-8 text-white" />
        </div>
        <h2 className="text-[56px] font-bold tracking-tight text-center">
          Ready to <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">streamline</span> your business?
        </h2>
        <p className="text-[24px] text-indigo-200/60 mt-4 text-center max-w-[800px]">
          Choose the plan that fits your team. Scale up any time.
        </p>

        <div className="grid grid-cols-3 gap-8 mt-14 w-full max-w-[1400px]">
          {TIERS.map((tier, i) => (
            <div
              key={tier.name}
              className={`rounded-2xl p-8 flex flex-col ${
                i === 1
                  ? "bg-gradient-to-b from-indigo-500/20 to-violet-500/10 border-2 border-indigo-500/40 scale-105"
                  : "bg-slate-800/40 border border-slate-700/40"
              }`}
            >
              {i === 1 && (
                <span className="text-[14px] uppercase tracking-widest text-indigo-400 font-medium mb-2">Most Popular</span>
              )}
              <h3 className="text-[32px] font-bold mb-6">{tier.name}</h3>
              <div className="space-y-3 flex-1">
                {tier.features.map((f) => (
                  <div key={f} className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-indigo-400 shrink-0" />
                    <span className="text-[20px] text-slate-200/80">{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-14 flex items-center gap-3">
          <div className="w-12 h-[2px] bg-indigo-500/50" />
          <span className="text-[20px] text-indigo-300/60">Contact us for a demo — let's build together</span>
          <div className="w-12 h-[2px] bg-indigo-500/50" />
        </div>
      </div>
    </SlideLayout>
  );
}
