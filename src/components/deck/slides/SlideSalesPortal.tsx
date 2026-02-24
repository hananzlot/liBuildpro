import { SlideLayout } from "../SlideLayout";
import { Briefcase, ClipboardList, Upload, FileText, CalendarDays, FolderOpen } from "lucide-react";

const FEATURES = [
  { icon: ClipboardList, label: "Scope Submissions", desc: "Reps submit job scopes from the field for office pricing." },
  { icon: FileText, label: "Estimate Creation", desc: "Create and manage estimates tied to their assigned leads." },
  { icon: Upload, label: "File Uploads", desc: "Upload photos, measurements, and documents per project." },
  { icon: FolderOpen, label: "Proposal Management", desc: "Track proposal status, send to clients, and get signatures." },
  { icon: CalendarDays, label: "Calendar Access", desc: "View upcoming appointments and confirm availability." },
];

export default function SlideSalesPortal() {
  return (
    <SlideLayout className="bg-gradient-to-br from-slate-950 via-slate-900 to-orange-950/40 text-white">
      <div className="flex flex-col h-full px-32 py-24">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-orange-400" />
          </div>
          <p className="text-[18px] uppercase tracking-[0.25em] text-orange-400/80 font-medium">Salesperson Portal</p>
        </div>
        <h2 className="text-[52px] font-bold leading-tight tracking-tight max-w-[1100px]">
          Empower your reps with a <span className="text-orange-400">dedicated workspace</span>
        </h2>

        <div className="grid grid-cols-3 gap-8 mt-14 flex-1">
          {FEATURES.slice(0, 3).map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-8 flex flex-col">
              <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center mb-5">
                <Icon className="w-6 h-6 text-orange-400" />
              </div>
              <h3 className="text-[24px] font-semibold mb-2">{label}</h3>
              <p className="text-[20px] text-slate-300/70 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-8 mt-6">
          {FEATURES.slice(3).map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-8 flex items-start gap-6">
              <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                <Icon className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <h3 className="text-[24px] font-semibold mb-2">{label}</h3>
                <p className="text-[20px] text-slate-300/70 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );
}
