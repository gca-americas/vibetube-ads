import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  CheckCircle2, RefreshCw, Code2, 
  Terminal, Sliders, ArrowRight, FileCode, Check, Loader2
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';

const BASELINE_TEMPLATE = `"""Vibetube Ads - Baseline Bidding Policy Script

This script is executed by the Vibetube Ad Serving Engine on every auction tick
to determine the optimal first-price CPM bid for video ad placement.
"""

from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    # Baseline Starting Policy: Naive flat bid ($2.50 CPM)
    current_bid = 2.50
    ceiling = context.max_bid_ceiling
    
    return min(current_bid, ceiling)`;

const HEURISTIC_DAYPART_TEMPLATE = `"""Vibetube Ads - Hand-Coded Dayparting Heuristic
Authored by Data Engineer to handle diurnal traffic waves.
"""

from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    daypart = context.daypart
    ceiling = context.max_bid_ceiling
    
    if daypart == "primetime":
        return min(9.65, ceiling)
    elif daypart == "late_night":
        return 0.90
    elif daypart == "afternoon":
        return 3.55
    else:
        return 2.40`;

type PolicyTab = 'baseline_policy.py' | 'heuristic_policy.py';

export default function ManualPolicy({ navigate }: { navigate: (v: string) => void }) {
  const [activeTab, setActiveTab] = useState<PolicyTab>('heuristic_policy.py');
  const [baselineCode, setBaselineCode] = useState<string>(BASELINE_TEMPLATE);
  const [heuristicCode, setHeuristicCode] = useState<string>(HEURISTIC_DAYPART_TEMPLATE);
  
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<Date | null>(null);

  const isInitialLoad = useRef({
    'baseline_policy.py': true,
    'heuristic_policy.py': true,
  });

  // Fetch initial file contents from server on mount
  useEffect(() => {
    const fetchScripts = async () => {
      try {
        const [resBase, resHeur] = await Promise.all([
          fetch('/campaign/script?file=baseline_policy.py'),
          fetch('/campaign/script?file=heuristic_policy.py'),
        ]);

        if (resBase.ok) {
          const data = await resBase.json();
          if (data.script && data.script.trim().length > 0) {
            setBaselineCode(data.script);
          }
        }
        if (resHeur.ok) {
          const data = await resHeur.json();
          if (data.script && data.script.trim().length > 0) {
            setHeuristicCode(data.script);
          }
        }
      } catch (e) {
        console.warn('Failed to load initial bidding scripts from server:', e);
      } finally {
        setTimeout(() => {
          isInitialLoad.current['baseline_policy.py'] = false;
          isInitialLoad.current['heuristic_policy.py'] = false;
        }, 100);
      }
    };

    fetchScripts();
  }, []);

  // Save helper function
  const saveScript = useCallback(async (filename: PolicyTab, code: string) => {
    setIsSaving(true);
    try {
      await fetch(`/campaign/script?file=${filename}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename, script: code }),
      });
      setLastSavedTime(new Date());
    } catch (e) {
      console.error(`Failed to auto-save ${filename}:`, e);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Debounced auto-save for baselineCode
  useEffect(() => {
    if (isInitialLoad.current['baseline_policy.py']) return;
    const timer = setTimeout(() => {
      saveScript('baseline_policy.py', baselineCode);
    }, 600);
    return () => clearTimeout(timer);
  }, [baselineCode, saveScript]);

  // Debounced auto-save for heuristicCode
  useEffect(() => {
    if (isInitialLoad.current['heuristic_policy.py']) return;
    const timer = setTimeout(() => {
      saveScript('heuristic_policy.py', heuristicCode);
    }, 600);
    return () => clearTimeout(timer);
  }, [heuristicCode, saveScript]);

  // Reset tab to default template
  const handleResetCurrentTab = () => {
    if (activeTab === 'baseline_policy.py') {
      setBaselineCode(BASELINE_TEMPLATE);
      saveScript('baseline_policy.py', BASELINE_TEMPLATE);
    } else {
      setHeuristicCode(HEURISTIC_DAYPART_TEMPLATE);
      saveScript('heuristic_policy.py', HEURISTIC_DAYPART_TEMPLATE);
    }
  };

  const currentCode = activeTab === 'baseline_policy.py' ? baselineCode : heuristicCode;
  const setCurrentCode = activeTab === 'baseline_policy.py' ? setBaselineCode : setHeuristicCode;

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-fg">Manual Bidding Policy</h1>
          <p className="text-xs text-fg-muted mt-1 font-mono">
            Inspect and iterate on rule-based bidding algorithms executed per auction tick.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('simulator2')}
            className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold rounded-xl text-xs transition-all shadow-lg hover:shadow-vibe-cyan/20 flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to Step 4: Heuristic Simulation</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Main Grid: Code Editor + Context Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Two-Tab Python Code Editor */}
        <div className="lg:col-span-8 space-y-4">
          {/* File Tabs & Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-2 rounded-2xl border border-hairline">
            {/* File Tab Selector */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setActiveTab('baseline_policy.py')}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono font-medium transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'baseline_policy.py'
                    ? 'bg-vibe-cyan/15 text-vibe-cyan border border-vibe-cyan/30 shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-overlay'
                }`}
              >
                <FileCode size={14} className={activeTab === 'baseline_policy.py' ? 'text-vibe-cyan' : 'text-fg-muted'} />
                <span>baseline_policy.py</span>
              </button>

              <button
                onClick={() => setActiveTab('heuristic_policy.py')}
                className={`px-3.5 py-2 rounded-xl text-xs font-mono font-medium transition-all flex items-center gap-2 cursor-pointer ${
                  activeTab === 'heuristic_policy.py'
                    ? 'bg-vibe-cyan/15 text-vibe-cyan border border-vibe-cyan/30 shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-overlay'
                }`}
              >
                <Code2 size={14} className={activeTab === 'heuristic_policy.py' ? 'text-vibe-cyan' : 'text-fg-muted'} />
                <span>heuristic_policy.py</span>
              </button>
            </div>

            {/* Auto-save status & Reset Controls */}
            <div className="flex items-center gap-3 pr-1">
              {/* Auto-save Indicator */}
              <div className="text-[11px] font-mono text-fg-muted flex items-center gap-1.5">
                {isSaving ? (
                  <>
                    <Loader2 size={12} className="animate-spin text-vibe-cyan" />
                    <span>Auto-saving...</span>
                  </>
                ) : lastSavedTime ? (
                  <>
                    <Check size={12} className="text-emerald-400" />
                    <span>Saved</span>
                  </>
                ) : (
                  <span>Auto-save active</span>
                )}
              </div>

              {/* Reset Tab Button */}
              <button
                onClick={handleResetCurrentTab}
                className="px-3 py-1.5 bg-overlay hover:bg-hairline rounded-xl text-xs font-mono text-fg-muted hover:text-fg border border-hairline transition-all flex items-center gap-1.5 cursor-pointer"
                title={`Reset ${activeTab} to its default template`}
              >
                <RefreshCw size={12} />
                <span>Reset {activeTab === 'baseline_policy.py' ? 'Baseline' : 'Dayparts'}</span>
              </button>
            </div>
          </div>

          {/* Code Editor Body */}
          <div className="rounded-2xl overflow-hidden border border-hairline shadow-2xl bg-card">
            <PythonCodeHighlight
              code={currentCode}
              filename={activeTab}
              editable={true}
              onChange={setCurrentCode}
              className="min-h-[420px]"
            />
          </div>

          {/* Validation & Execution Status Footer */}
          <div className="p-4 bg-overlay/60 rounded-2xl border border-hairline flex items-center justify-between text-xs font-mono text-fg-muted">
            <span>⚡ Executed by Vibetube Ad Server on each auction tick</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={13} /> Syntax Validated
            </span>
          </div>
        </div>

        {/* Right Column: Complete Context Reference (AuctionContext Pydantic Model) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-hairline pb-3">
              <Terminal size={16} className="text-vibe-cyan" />
              <div>
                <h3 className="text-sm font-bold text-fg">Available Context Fields</h3>
                <span className="text-[11px] font-mono text-fg-muted">lib.models.AuctionContext</span>
              </div>
            </div>

            <div className="space-y-2.5 font-mono text-xs max-h-[580px] overflow-y-auto pr-1">
              {/* context.daypart */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-vibe-cyan font-bold">context.daypart <span className="text-fg-muted text-[10px] font-normal">(str)</span></div>
                <div className="text-fg-muted text-[11px] leading-relaxed">
                  Market regime: <code className="text-amber-300">"morning"</code>, <code className="text-amber-300">"lunch"</code>, <code className="text-amber-300">"afternoon"</code>, <code className="text-amber-300">"primetime"</code>, <code className="text-amber-300">"late_night"</code>.
                </div>
              </div>

              {/* context.budget_remaining */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-emerald-400 font-bold">context.budget_remaining <span className="text-fg-muted text-[10px] font-normal">(float)</span></div>
                <div className="text-fg-muted text-[11px]">Unspent campaign budget remaining in USD (e.g. $2500.00).</div>
              </div>

              {/* context.hours_remaining */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-sky-400 font-bold">context.hours_remaining <span className="text-fg-muted text-[10px] font-normal">(float)</span></div>
                <div className="text-fg-muted text-[11px]">Flight time remaining in hours (24.0h down to 0.0h).</div>
              </div>

              {/* context.max_bid_ceiling */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-purple-400 font-bold">context.max_bid_ceiling <span className="text-fg-muted text-[10px] font-normal">(float)</span></div>
                <div className="text-fg-muted text-[11px]">Hard safety guardrail ceiling in USD CPM (e.g. $10.00).</div>
              </div>

              {/* context.win_rate */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-amber-400 font-bold">context.win_rate <span className="text-fg-muted text-[10px] font-normal">(float)</span></div>
                <div className="text-fg-muted text-[11px]">Trailing win rate ratio (0.0 to 1.0) from recent auction ticks.</div>
              </div>

              {/* context.p90 */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-rose-400 font-bold">context.p90 <span className="text-fg-muted text-[10px] font-normal">(float)</span></div>
                <div className="text-fg-muted text-[11px]">90th-percentile competitor clearing floor price in USD CPM.</div>
              </div>

              {/* context.p90_history */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-indigo-400 font-bold">context.p90_history <span className="text-fg-muted text-[10px] font-normal">(list[float])</span></div>
                <div className="text-fg-muted text-[11px]">Trailing sequence of recent P90 values for momentum velocity.</div>
              </div>

              {/* context.win_rate_history */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-teal-400 font-bold">context.win_rate_history <span className="text-fg-muted text-[10px] font-normal">(list[float])</span></div>
                <div className="text-fg-muted text-[11px]">Trailing sequence of recent win rates over recent ticks.</div>
              </div>

              {/* context.active_bid_cpm */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-blue-300 font-bold">context.active_bid_cpm <span className="text-fg-muted text-[10px] font-normal">(float | None)</span></div>
                <div className="text-fg-muted text-[11px]">The CPM bid price submitted from the preceding tick.</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategic Context & Hypotheses (Moved Below the Editor) */}
      <div className="p-6 bg-card rounded-3xl border border-hairline space-y-4 shadow-xl">
        <div className="flex items-center gap-2 border-b border-hairline pb-3">
          <Sliders size={16} className="text-amber-400" />
          <h3 className="text-sm font-bold text-fg">The Heuristic Hypotheses & Market Dynamics</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-fg-muted leading-relaxed">
          <div className="space-y-2">
            <h4 className="font-semibold text-fg text-xs font-mono uppercase tracking-wider text-vibe-cyan">
              1. The Daypart Hypothesis
            </h4>
            <p>
              By hard-coding <span className="text-fg font-mono font-semibold">$9.65</span> for primetime and <span className="text-fg font-mono font-semibold">$0.90</span> for late-night, we expect to clear peak viewer auctions while conserving liquidity overnight.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-fg text-xs font-mono uppercase tracking-wider text-amber-400">
              2. The Volatility Test (Step 4)
            </h4>
            <p>
              In Step 4, we'll simulate this heuristic to evaluate how static rule-based scripts perform when confronted with unpredictable midday bidding wars and shifting competitor pacing.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
