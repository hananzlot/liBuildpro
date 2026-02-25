import { SlideLayout } from "../SlideLayout";
import { Globe, Lock, MessageSquare, FileCheck, Eye, Shield } from "lucide-react";
import screenshotClientPortal from "@/assets/deck/sc11.png";

const FEATURES = [
  { icon: Lock, label: "Passcode Access", desc: "Secure, tokenized portal links — no login required for clients." },
  { icon: Eye, label: "Project Status", desc: "Clients see real-time progress, photos, and milestones." },
  { icon: FileCheck, label: "Document Signing", desc: "Review and sign contracts directly in the portal." },
  { icon: MessageSquare, label: "Live Chat + SMS", desc: "Two-way messaging between client and your office." },
  { icon: Shield, label: "Compliance Docs", desc: "Insurance, licenses, and permits visible to homeowners." },
];

export default function SlideClientPortal() {
  return (
    <SlideLayout className="bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950/40 text-white">
      <div className="flex h-full">
        <div className="w-[55%] flex flex-col px-28 py-24">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-teal-500/15 flex items-center justify-center">
              <Globe className="w-6 h-6 text-teal-400" />
            </div>
            <p className="text-[18px] uppercase tracking-[0.25em] text-teal-400/80 font-medium">Client Portal</p>
          </div>
          <h2 className="text-[52px] font-bold leading-tight tracking-tight">
            Give homeowners <span className="text-teal-400">full visibility</span>
          </h2>
          <div className="mt-12 space-y-7 flex-1">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <Icon className="w-5 h-5 text-teal-400 mt-1 shrink-0" />
                <div>
                  <span className="text-[22px] font-semibold">{label}</span>
                  <span className="text-[20px] text-slate-300/70 ml-2">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="w-[45%] flex items-center justify-center p-12">
          <div className="w-[340px] h-[680px] rounded-[40px] overflow-hidden border-2 border-slate-700/50 shadow-2xl shadow-teal-500/10">
            <img src={screenshotClientPortal} alt="Mobile client portal showing project status, photo gallery, messaging, and document signing" className="w-full h-full object-cover" />
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
