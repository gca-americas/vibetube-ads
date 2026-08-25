import { 
  Trophy, CheckCircle2, DollarSign, Eye, 
  RotateCcw, Sparkles, ArrowRight, Zap
} from 'lucide-react';

export default function Scorecard({ navigate }: { navigate: (v: string) => void }) {
  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-overlay border border-hairline text-emerald-400 flex items-center gap-1">
              <Trophy size={11} /> Step 7 of 7 · Final Executive Scorecard
            </span>
            <span className="text-xs font-mono text-fg-muted">From Rules to Reasoning</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-fg">Flight Performance Scorecard</h1>
          <p className="text-xs sm:text-sm text-fg-muted mt-1 max-w-2xl">
            Side-by-side comparison of 24-hour delivery, budget efficiency, and clearing price dynamics across all three iterations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('console')}
            className="px-6 py-3 bg-overlay hover:bg-hairline text-fg font-medium rounded-2xl text-xs border border-hairline transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw size={14} /> Return to Mission Briefing
          </button>

          <button
            onClick={() => navigate('campaigns')}
            className="px-7 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold rounded-2xl text-xs transition-all shadow-lg hover:shadow-vibe-cyan/20 flex items-center gap-2 cursor-pointer"
          >
            <span>Start New Flight</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* 3-Way Side-by-Side Comparison Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card 1: Attempt 1 (Baseline) */}
        <div className="p-6 bg-card border border-hairline rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-fg-muted">Attempt 1</span>
              <h3 className="text-base font-bold text-fg">Static Flat Bid</h3>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-overlay text-fg-muted border border-hairline text-xs font-mono">
              $2.50 Fixed
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-hairline/50">
              <span className="text-fg-muted flex items-center gap-1.5"><Eye size={14} /> Impressions:</span>
              <span className="font-bold text-fg">242,100 (24.2%)</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-hairline/50">
              <span className="text-fg-muted flex items-center gap-1.5"><DollarSign size={14} /> Total Spend:</span>
              <span className="font-bold text-fg">$605.25</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-hairline/50">
              <span className="text-fg-muted">Budget Remaining:</span>
              <span className="font-bold text-red-400">$1,894.75 (Unspent)</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-fg-muted">Effective CPM:</span>
              <span className="font-bold text-fg">$2.50 CPM</span>
            </div>
          </div>

          <div className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl space-y-1 text-xs">
            <div className="font-bold text-red-400">Diagnosis: Underdelivery</div>
            <p className="text-fg-muted leading-relaxed">
              Overpaid 3x on overnight $0.85 inventory; totally blacked out during lunch ($4.20) and primetime ($9.60).
            </p>
          </div>
        </div>

        {/* Card 2: Attempt 2 (Heuristic Dayparts) */}
        <div className="p-6 bg-card border border-hairline rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-fg-muted">Attempt 2</span>
              <h3 className="text-base font-bold text-fg">Manual Dayparts</h3>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 text-xs font-mono">
              Static Rules
            </span>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-hairline/50">
              <span className="text-fg-muted flex items-center gap-1.5"><Eye size={14} /> Impressions:</span>
              <span className="font-bold text-fg">554,800 (55.5%)</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-hairline/50">
              <span className="text-fg-muted flex items-center gap-1.5"><DollarSign size={14} /> Total Spend:</span>
              <span className="font-bold text-fg">$2,500.00</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-hairline/50">
              <span className="text-fg-muted">Budget Remaining:</span>
              <span className="font-bold text-amber-400">$0.00 (Exhausted)</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-fg-muted">Effective CPM:</span>
              <span className="font-bold text-amber-300">$4.51 CPM</span>
            </div>
          </div>

          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl space-y-1 text-xs">
            <div className="font-bold text-amber-400">Diagnosis: Lag Trap & Drain</div>
            <p className="text-fg-muted leading-relaxed">
              Better delivery, but static rules overpaid after competitor crashed ($3.55 vs $1.80) and exhausted budget early.
            </p>
          </div>
        </div>

        {/* Card 3: Attempt 3 (ADK AI Agent) */}
        <div className="p-6 bg-card border-2 border-emerald-500/40 rounded-3xl space-y-4 shadow-[0_0_40px_rgba(52,211,153,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 px-3 py-1 bg-gradient-to-l from-emerald-400 to-vibe-cyan text-black font-bold text-[10px] font-mono rounded-bl-xl uppercase tracking-wider">
            Optimal Winner
          </div>

          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <div>
              <span className="text-[10px] font-mono font-bold uppercase text-emerald-400">Attempt 3</span>
              <h3 className="text-base font-bold text-fg flex items-center gap-1.5">
                <span>ADK 2.0 Agent</span>
                <Sparkles size={14} className="text-vibe-cyan" />
              </h3>
            </div>
          </div>

          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between items-center py-1.5 border-b border-hairline/50">
              <span className="text-fg-muted flex items-center gap-1.5"><Eye size={14} /> Impressions:</span>
              <span className="font-bold text-emerald-400">945,200 (94.5%)</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-hairline/50">
              <span className="text-fg-muted flex items-center gap-1.5"><DollarSign size={14} /> Total Spend:</span>
              <span className="font-bold text-fg">$2,468.50</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-hairline/50">
              <span className="text-fg-muted">Budget Remaining:</span>
              <span className="font-bold text-emerald-400">$31.50 (Paced)</span>
            </div>
            <div className="flex justify-between items-center py-1.5">
              <span className="text-fg-muted">Effective CPM:</span>
              <span className="font-bold text-emerald-400">$2.61 CPM</span>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl space-y-1 text-xs">
            <div className="font-bold text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={13} /> Full Yield Optimization
            </div>
            <p className="text-fg-muted leading-relaxed">
              Bid shading protected overnight liquidity; momentum tracking rode bidding wars and paced spend across 24 hours.
            </p>
          </div>
        </div>
      </div>

      {/* Core Architectural Insight Card */}
      <div className="p-7 bg-card rounded-3xl border border-hairline shadow-2xl space-y-4">
        <div className="flex items-center gap-2 border-b border-hairline pb-4">
          <Zap size={18} className="text-amber-400" />
          <h3 className="text-base font-bold text-fg">
            Key Architectural Takeaway: Code Generation vs LLM in the Loop
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-fg-muted leading-relaxed">
          <div className="space-y-2 p-4 bg-overlay rounded-2xl border border-hairline">
            <h4 className="font-bold text-fg text-sm">❌ Anti-Pattern: LLM in the Auction Loop</h4>
            <p>
              Placing an LLM call directly inside real-time ad bidding pipelines introduces 200–500ms latency and high compute cost per auction, failing strict 10ms ad server SLAs.
            </p>
          </div>

          <div className="space-y-2 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-fg">
            <h4 className="font-bold text-emerald-400 text-sm">✅ Best Practice: Agentic Data Engineering</h4>
            <p className="text-fg-muted">
              Using Google Cloud ADK 2.0 and Gemini 2.5 Flash to analyze BigQuery telemetry and generate deterministic, high-throughput Python code delivers deep economic reasoning with sub-millisecond execution.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
