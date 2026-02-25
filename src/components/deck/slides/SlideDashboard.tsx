import { SlideLayout } from "../SlideLayout";
import { LayoutDashboard, Users, CalendarCheck, BarChart3, Bell, Plug } from "lucide-react";
import screenshotDashboard from "@/assets/deck/sc15.png";

const FEATURES = [
  { icon: Users, label: "Lead Tracking", desc: "Every opportunity synced from GHL with status, source, and assigned rep." },
  { icon: CalendarCheck, label: "Appointment Management", desc: "Schedule, confirm, and track appointments with salesperson notifications." },
  { icon: BarChart3, label: "Sales Leaderboards", desc: "Real-time rep performance, close rates, and revenue rankings." },
  { icon: Bell, label: "Follow-Up Engine", desc: "Automated task tracking so no lead goes cold." },
  { icon: Plug, label: "GHL Integration", desc: "Bi-directional sync of contacts, opportunities, and appointments." },
];

export default function SlideDashboard() {
  return (
    <SlideLayout className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950/40 text-white">
      <div className="flex h-full">
        {/* Left info */}
        <div className="w-[50%] flex flex-col px-24 py-24">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <LayoutDashboard className="w-6 h-6 text-emerald-400" />
            </div>
            <p className="text-[18px] uppercase tracking-[0.25em] text-emerald-400/80 font-medium">Dispatch Dashboard</p>
          </div>
          <h2 className="text-[48px] font-bold leading-tight tracking-tight">
            Your command center for <span className="text-emerald-400">sales operations</span>
          </h2>
          <div className="mt-10 space-y-5 flex-1">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <Icon className="w-5 h-5 text-emerald-400 mt-1 shrink-0" />
                <div>
                  <span className="text-[20px] font-semibold">{label}</span>
                  <span className="text-[18px] text-slate-300/70 ml-2">{desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Right screenshot */}
        <div className="w-[50%] flex items-center justify-center p-10">
          <div className="w-full h-[90%] rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-emerald-500/10">
            <img src={screenshotDashboard} alt="Dispatch Dashboard showing KPI cards, source analytics, and sales rep performance" className="w-full h-full object-cover object-left-top" />
          </div>
        </div>
      </div>
    </SlideLayout>
  );
}
