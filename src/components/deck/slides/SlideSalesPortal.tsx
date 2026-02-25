import { SlideLayout } from "../SlideLayout";
import { Briefcase, ClipboardList, Upload, FileText, CalendarDays, FolderOpen } from "lucide-react";
import screenshotFollowup from "@/assets/deck/sc13.png";

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
      <div className="flex flex-col h-full px-32 py-20">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <Briefcase className="w-6 h-6 text-orange-400" />
          </div>
          <p className="text-[18px] uppercase tracking-[0.25em] text-orange-400/80 font-medium">Salesperson Portal</p>
        </div>
        <h2 className="text-[48px] font-bold leading-tight tracking-tight max-w-[1100px]">
          Empower your reps with a <span className="text-orange-400">dedicated workspace</span>
        </h2>

        <div className="flex gap-10 mt-8 flex-1">
          {/* Left: Features */}
          <div className="w-[40%] grid grid-cols-1 gap-5">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-orange-400" />
                </div>
                <div>
                  <h3 className="text-[22px] font-semibold">{label}</h3>
                  <p className="text-[18px] text-slate-300/70 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          {/* Right: Screenshot */}
          <div className="w-[60%] rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-orange-500/10">
            <img src={screenshotFollowup} alt="Follow-up management showing task buckets, stale opportunities, and attention alerts" className="w-full h-full object-cover object-left-top" />
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
