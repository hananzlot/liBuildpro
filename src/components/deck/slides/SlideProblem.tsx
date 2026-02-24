import { SlideLayout } from "../SlideLayout";
import { AlertTriangle, Search, Clock, DollarSign } from "lucide-react";

const PAINS = [
  { icon: AlertTriangle, title: "Scattered Tools", desc: "Spreadsheets, paper forms, and disconnected apps create data silos and errors." },
  { icon: Search, title: "No Pipeline Visibility", desc: "Leads fall through the cracks with no centralized tracking across reps and locations." },
  { icon: Clock, title: "Manual Project Tracking", desc: "Hours wasted updating status, chasing subcontractors, and reconciling bills by hand." },
  { icon: DollarSign, title: "Lost Revenue", desc: "Missed follow-ups, slow proposals, and billing delays cost thousands each month." },
];

export default function SlideProblem() {
  return (
    <SlideLayout className="bg-gradient-to-br from-slate-950 via-slate-900 to-red-950/40 text-white">
      <div className="flex flex-col h-full px-32 py-24">
        <p className="text-[18px] uppercase tracking-[0.25em] text-red-400/80 font-medium mb-4">The Problem</p>
        <h2 className="text-[56px] font-bold leading-tight tracking-tight max-w-[1100px]">
          Contractors lose <span className="text-red-400">time & money</span> with disconnected workflows
        </h2>

        <div className="grid grid-cols-2 gap-10 mt-16 flex-1">
          {PAINS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-6 items-start">
              <div className="w-16 h-16 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Icon className="w-7 h-7 text-red-400" />
              </div>
              <div>
                <h3 className="text-[28px] font-semibold mb-2">{title}</h3>
                <p className="text-[22px] text-slate-300/80 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}
