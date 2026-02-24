import { SlideLayout } from "../SlideLayout";
import { FileText, Wand2, Send, Printer, ListChecks, DollarSign } from "lucide-react";

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
      <div className="flex flex-col h-full px-32 py-24">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <FileText className="w-6 h-6 text-amber-400" />
          </div>
          <p className="text-[18px] uppercase tracking-[0.25em] text-amber-400/80 font-medium">Estimates & Proposals</p>
        </div>
        <h2 className="text-[52px] font-bold leading-tight tracking-tight max-w-[1000px]">
          From scope to <span className="text-amber-400">signed contract</span> in minutes
        </h2>

        <div className="grid grid-cols-3 gap-8 mt-14 flex-1">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-8 flex flex-col">
              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center mb-5">
                <Icon className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-[24px] font-semibold mb-2">{label}</h3>
              <p className="text-[20px] text-slate-300/70 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}
