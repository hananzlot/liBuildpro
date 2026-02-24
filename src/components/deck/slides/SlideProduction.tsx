import { SlideLayout } from "../SlideLayout";
import { HardHat, Kanban, Receipt, Camera, FileText, Users, Truck } from "lucide-react";

const FEATURES = [
  { icon: Kanban, label: "Kanban & Table Views", desc: "Visual project boards with drag-and-drop stage management." },
  { icon: Receipt, label: "Financial Tracking", desc: "Bills, invoices, deposits, and commission payments per project." },
  { icon: Camera, label: "Photo Management", desc: "Before/after galleries with direct upload from the field." },
  { icon: FileText, label: "Notes & Documents", desc: "Centralized project notes, files, and compliance docs." },
  { icon: Users, label: "Subcontractor Management", desc: "Vendor mapping, assignment tracking, and payment history." },
  { icon: Truck, label: "Full Lifecycle", desc: "From contract signed to completion, every step tracked." },
];

export default function SlideProduction() {
  return (
    <SlideLayout className="bg-gradient-to-br from-slate-950 via-slate-900 to-sky-950/40 text-white">
      <div className="flex flex-col h-full px-32 py-24">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-lg bg-sky-500/15 flex items-center justify-center">
            <HardHat className="w-6 h-6 text-sky-400" />
          </div>
          <p className="text-[18px] uppercase tracking-[0.25em] text-sky-400/80 font-medium">Production Management</p>
        </div>
        <h2 className="text-[52px] font-bold leading-tight tracking-tight max-w-[1100px]">
          Manage every project from <span className="text-sky-400">contract to completion</span>
        </h2>

        <div className="grid grid-cols-3 gap-8 mt-14 flex-1">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-8 flex flex-col">
              <div className="w-12 h-12 rounded-lg bg-sky-500/10 flex items-center justify-center mb-5">
                <Icon className="w-6 h-6 text-sky-400" />
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
