import { SlideLayout } from "../SlideLayout";
import { Hammer } from "lucide-react";

export default function SlideTitle() {
  return (
    <SlideLayout className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white flex flex-col items-center justify-center">
      <div className="flex flex-col items-center justify-center h-full w-full px-40 text-center">
        <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mb-10 shadow-2xl shadow-indigo-500/30">
          <Hammer className="w-12 h-12 text-white" />
        </div>
         <h1 className="text-[80px] font-bold leading-[1.05] tracking-tight bg-gradient-to-r from-white via-white to-indigo-200 bg-clip-text text-transparent">
           iBuildPro<br />Contractor CRM
         </h1>
        <p className="mt-8 text-[28px] text-indigo-200/80 max-w-[900px] leading-relaxed">
          Dispatch · Estimates · Production · Analytics · Client Portal — unified in a single platform built for home services companies.
        </p>
        <div className="mt-16 flex items-center gap-3">
          <div className="w-12 h-[2px] bg-indigo-500/50" />
          <span className="text-[18px] text-indigo-300/60 tracking-widest uppercase">Press → to begin</span>
          <div className="w-12 h-[2px] bg-indigo-500/50" />
        </div>
      </div>
    </SlideLayout>
  );
}
