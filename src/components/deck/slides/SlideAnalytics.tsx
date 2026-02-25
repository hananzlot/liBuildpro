import { SlideLayout } from "../SlideLayout";
import { TrendingUp, PieChart, FileSpreadsheet, Wallet, CreditCard, ArrowRightLeft } from "lucide-react";
import screenshotAnalytics from "@/assets/deck/sc3.png";

const FEATURES = [
  { icon: TrendingUp, label: "Profitability Analysis", desc: "Real-time margins by project, rep, and time period." },
  { icon: Wallet, label: "Cash Flow Tracking", desc: "Monitor money in and out across all active projects." },
  { icon: FileSpreadsheet, label: "P&L Statements", desc: "Automated profit & loss reports with drill-down." },
  { icon: PieChart, label: "Balance Sheets", desc: "Asset, liability, and equity snapshots on demand." },
  { icon: CreditCard, label: "AR / AP Management", desc: "Outstanding receivables and payables at a glance." },
  { icon: ArrowRightLeft, label: "QuickBooks Sync", desc: "Bi-directional integration keeps books in perfect sync." },
];

export default function SlideAnalytics() {
  return (
    <SlideLayout className="bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950/40 text-white">
      <div className="flex flex-col h-full px-32 py-20">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-[18px] uppercase tracking-[0.25em] text-violet-400/80 font-medium">Financial Analytics</p>
        </div>
        <h2 className="text-[48px] font-bold leading-tight tracking-tight max-w-[1100px]">
          Know your numbers. <span className="text-violet-400">Grow your profit.</span>
        </h2>

        <div className="flex gap-10 mt-8 flex-1">
          {/* Left: Screenshot */}
          <div className="w-[58%] rounded-2xl overflow-hidden border border-slate-700/50 shadow-2xl shadow-violet-500/10">
            <img src={screenshotAnalytics} alt="Analytics dashboard showing $1.3M total sold, profit by project bar charts, and profit by salesperson" className="w-full h-full object-cover object-left-top" />
          </div>
          {/* Right: Features */}
          <div className="w-[42%] grid grid-cols-1 gap-5">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-violet-400" />
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
