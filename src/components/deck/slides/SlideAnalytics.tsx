import { SlideLayout } from "../SlideLayout";
import { TrendingUp, PieChart, FileSpreadsheet, Wallet, CreditCard, ArrowRightLeft } from "lucide-react";

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
      <div className="flex flex-col h-full px-32 py-24">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-lg bg-violet-500/15 flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-[18px] uppercase tracking-[0.25em] text-violet-400/80 font-medium">Financial Analytics</p>
        </div>
        <h2 className="text-[52px] font-bold leading-tight tracking-tight max-w-[1100px]">
          Know your numbers. <span className="text-violet-400">Grow your profit.</span>
        </h2>

        <div className="grid grid-cols-3 gap-8 mt-14 flex-1">
          {FEATURES.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="rounded-2xl bg-slate-800/40 border border-slate-700/40 p-8 flex flex-col">
              <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center mb-5">
                <Icon className="w-6 h-6 text-violet-400" />
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
