import { SlideLayout } from "../SlideLayout";
import { FileText, Wand2, Send, Printer, ListChecks, DollarSign } from "lucide-react";
import screenshotEstimates from "@/assets/deck/screenshot-estimates.jpg";

const FEATURES = [
  { icon: Wand2, label: "AI-Powered Builder", desc: "Generate line items from scope descriptions instantly." },
  { icon: ListChecks, label: "Line-Item Pricing", desc: "Granular cost breakdowns with materials, labor, and markup." },
  { icon: FileText, label: "Proposal Generation", desc: "Beautiful PDF proposals with your branding and terms." },
  { icon: Send, label: "Digital Sending", desc: "Email proposals with portal links for client review." },
  { icon: Printer, label: "Contract Printing", desc: "Print-ready contracts with compliance documents attached." },
  { icon: DollarSign, label: "Scope-to-Estimate", desc: "Sales reps submit scopes; office prices and sends estimates." },
];

export default function SlideEstimates() {
  return (
    <SlideLayout className="bg-gradient-to-br from-slate-950 via-slate-900 to-amber-950/40 text-white">
      <div className="flex flex-col h-full px-32 py-20">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <FileText className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-[18px] uppercase tracking-[0.25em] text-amber-400/80 font-medium">Estimates & Proposals</p>
        </div>
        <h2 className="text-[48px] font-bold leading-tight tracking-tight max-w-[1000px]">
          From scope to <span className="text-amber-400">signed contract</span> in minutes
        </h2>

        <div className="flex gap-10 mt-10 flex-1">
          {/* Left: Screenshot */}
          <div className="w-[55%] rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-amber-500/10">
            <img src={screenshotEstimates} alt="Estimates list showing proposals totaling $6.3M with customer details" className="w-full h-full object-cover object-left-top" />
          </div>
          {/* Right: Features */}
          <div className="w-[45%] grid grid-cols-1 gap-5">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <h3 className="text-[22px] font-semibold">{label}</h3>
                  <p className="text-[18px] text-slate-300/70 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
