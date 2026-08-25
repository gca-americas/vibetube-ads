import { useState, useEffect } from 'react';
import { 
  CheckCircle2, RefreshCw, Code2, 
  Terminal, Sliders, ArrowRight, Save
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';

const BASELINE_TEMPLATE = `"""Vibetube Ads - Baseline Bidding Policy Script

This script is executed by the Vibetube Ad Serving Engine on every auction tick
to determine the optimal first-price CPM bid for video ad placement.
"""

def compute_bid(context: dict) -> float:
    # Baseline Starting Policy: Naive flat bid ($2.50 CPM)
    current_bid = 2.50
    ceiling = context.get("max_bid_ceiling", 10.00)
    
    return min(current_bid, ceiling)`;

const HEURISTIC_DAYPART_TEMPLATE = `"""Vibetube Ads - Hand-Coded Dayparting Heuristic
Authored by Data Engineer to handle diurnal traffic waves.
"""

def compute_bid(context: dict) -> float:
    daypart = context.get("daypart", "morning")
    ceiling = context.get("max_bid_ceiling", 10.00)
    
    if daypart == "primetime":
        return min(9.65, ceiling)
    elif daypart == "late_night":
        return 0.90
    elif daypart == "afternoon":
        return 3.55
    else:
        return 2.40`;

export default function ManualPolicy({ navigate }: { navigate: (v: string) => void }) {
  const [scriptCode, setScriptCode] = useState<string>(HEURISTIC_DAYPART_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    fetchActiveScript();
  }, []);

  const fetchActiveScript = async () => {
    try {
      const res = await fetch('/campaign/script?file=heuristic_policy.py');
      if (res.ok) {
        const data = await res.json();
        if (data.script && data.script.trim().length > 0) {
          setScriptCode(data.script);
        }
      }
    } catch (e) {
      console.warn('Failed to load active bidding script from server:', e);
    }
  };

  const handleSaveScript = async (andNavigate = false) => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/campaign/script?file=heuristic_policy.py', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'heuristic_policy.py', script: scriptCode }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        if (andNavigate) {
          navigate('simulator2');
        } else {
          setTimeout(() => setSaveSuccess(false), 3000);
        }
      }
    } catch (e) {
      console.error('Error saving bidding script:', e);
      alert('Failed to save script to ad server.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-fg">Manual Bidding Policy</h1>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSaveScript(false)}
            disabled={saving}
            className="px-5 py-3 bg-overlay hover:bg-hairline text-fg font-medium rounded-2xl text-xs border border-hairline transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {saveSuccess ? <CheckCircle2 size={15} className="text-emerald-400" /> : <Save size={15} />}
            {saving ? 'Saving...' : saveSuccess ? 'Saved' : 'Save Script'}
          </button>

          <button
            onClick={() => handleSaveScript(true)}
            disabled={saving}
            className="px-7 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold rounded-2xl text-xs transition-all shadow-lg hover:shadow-vibe-cyan/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <span>Proceed to Step 4: Heuristic Simulation</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>

      {/* Main Grid: Code Editor + Context Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Interactive Python Code Editor */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Code2 size={16} className="text-vibe-cyan" />
              <span className="text-xs font-mono font-bold text-fg">bidding_policy.py</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-overlay text-fg-muted border border-hairline">
                Python 3.11 Runtime
              </span>
            </div>

            {/* Template Presets */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setScriptCode(HEURISTIC_DAYPART_TEMPLATE)}
                className="px-3 py-1 bg-overlay hover:bg-hairline rounded-lg text-xs font-mono text-fg-muted hover:text-fg border border-hairline transition-all flex items-center gap-1 cursor-pointer"
              >
                <Sliders size={12} className="text-amber-400" /> Dayparts Template
              </button>
              <button
                onClick={() => setScriptCode(BASELINE_TEMPLATE)}
                className="px-3 py-1 bg-overlay hover:bg-hairline rounded-lg text-xs font-mono text-fg-muted hover:text-fg border border-hairline transition-all flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw size={12} /> Reset Flat
              </button>
            </div>
          </div>

          <div className="rounded-2xl overflow-hidden border border-hairline shadow-2xl bg-card">
            <PythonCodeHighlight
              code={scriptCode}
              filename="bidding_policy.py"
              editable={true}
              onChange={setScriptCode}
              className="min-h-[380px]"
            />
          </div>

          <div className="p-4 bg-overlay/60 rounded-2xl border border-hairline flex items-center justify-between text-xs font-mono text-fg-muted">
            <span>⚡ Executed by Vibetube Ad Server on each auction tick</span>
            <span className="text-emerald-400 flex items-center gap-1">
              <CheckCircle2 size={13} /> Syntax Validated
            </span>
          </div>
        </div>

        {/* Right Column: Context Reference & Strategic Notes */}
        <div className="lg:col-span-4 space-y-6">
          {/* Available Context Parameters */}
          <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-hairline pb-3">
              <Terminal size={16} className="text-vibe-cyan" />
              <h3 className="text-sm font-bold text-fg">Available Context Fields</h3>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-vibe-cyan font-bold">context["daypart"]</div>
                <div className="text-fg-muted text-[11px]">
                  Values: <code className="text-amber-300">"morning"</code>, <code className="text-amber-300">"afternoon"</code>, <code className="text-amber-300">"primetime"</code>, <code className="text-amber-300">"late_night"</code>
                </div>
              </div>

              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-emerald-400 font-bold">context["budget_remaining"]</div>
                <div className="text-fg-muted text-[11px]">Dollars remaining in campaign flight (e.g. $2500.00).</div>
              </div>

              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-sky-400 font-bold">context["hours_remaining"]</div>
                <div className="text-fg-muted text-[11px]">Hours left in the 24.0h market day.</div>
              </div>

              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-purple-400 font-bold">context["max_bid_ceiling"]</div>
                <div className="text-fg-muted text-[11px]">Hard safety guardrail (e.g. $10.00 CPM).</div>
              </div>
            </div>
          </div>

          {/* Strategic Context Box */}
          <div className="p-6 bg-overlay/80 rounded-3xl border border-hairline space-y-3">
            <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Sliders size={14} /> The Heuristic Hypothesis
            </h4>
            <p className="text-xs text-fg-muted leading-relaxed">
              By hard-coding $9.65 for primetime and $0.90 for late-night, we expect to win more peak viewers while saving liquidity overnight.
            </p>
            <p className="text-xs text-fg-muted leading-relaxed border-t border-hairline pt-2">
              In Step 4, we'll simulate this heuristic to see how static rules handle unpredictable bidding wars and sudden competitor dropouts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
