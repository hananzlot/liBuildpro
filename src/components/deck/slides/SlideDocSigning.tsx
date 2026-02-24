import { SlideLayout } from "../SlideLayout";
import { PenTool, Building2, Users, ShieldCheck, Layers, Settings } from "lucide-react";

export default function SlideDocSigning() {
  return (
    <SlideLayout className="bg-gradient-to-br from-slate-950 via-slate-900 to-pink-950/40 text-white">
      <div className="flex h-full">
        {/* Left: Document Signing */}
        <div className="w-1/2 flex flex-col px-24 py-24 border-r border-slate-700/30">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-pink-500/15 flex items-center justify-center">
              <PenTool className="w-6 h-6 text-pink-400" />
            </div>
            <p className="text-[18px] uppercase tracking-[0.25em] text-pink-400/80 font-medium">Document Signing</p>
          </div>
          <h2 className="text-[44px] font-bold leading-tight tracking-tight">
            Digital signatures, <span className="text-pink-400">done right</span>
          </h2>
          <div className="mt-10 space-y-6 flex-1">
            {[
              { icon: Users, label: "Multi-Signer Support", desc: "Route documents through multiple signers in order." },
              { icon: Layers, label: "Signature Templates", desc: "Reusable field placements across document types." },
              { icon: ShieldCheck, label: "Audit Trail", desc: "IP, timestamp, and user-agent captured per signature." },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <Icon className="w-5 h-5 text-pink-400 mt-1 shrink-0" />
                <div>
                  <span className="text-[22px] font-semibold">{label}</span>
                  <p className="text-[20px] text-slate-300/70">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Multi-Tenant */}
        <div className="w-1/2 flex flex-col px-24 py-24">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Building2 className="w-6 h-6 text-cyan-400" />
            </div>
            <p className="text-[18px] uppercase tracking-[0.25em] text-cyan-400/80 font-medium">Multi-Tenant</p>
          </div>
          <h2 className="text-[44px] font-bold leading-tight tracking-tight">
            Built for <span className="text-cyan-400">scale</span>
          </h2>
          <div className="mt-10 space-y-6 flex-1">
            {[
              { icon: Building2, label: "Per-Company Isolation", desc: "Each company has its own data, settings, and branding." },
              { icon: Settings, label: "Feature Gating", desc: "Toggle features per plan or per company." },
              { icon: ShieldCheck, label: "Super-Admin Controls", desc: "Platform-wide management, backups, and user oversight." },
            ].map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <Icon className="w-5 h-5 text-cyan-400 mt-1 shrink-0" />
                <div>
                  <span className="text-[22px] font-semibold">{label}</span>
                  <p className="text-[20px] text-slate-300/70">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
