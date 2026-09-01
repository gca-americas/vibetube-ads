import { useState, useEffect, useRef } from 'react';
import { 
  RefreshCw, Code2, 
  Terminal, ArrowRight, FileCode, Check, Loader2,
  CheckCircle2, AlertTriangle
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
type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved';

interface ValidationResult {
  valid: boolean;
  message: string;
  error_type?: string;
  line?: number | null;
  offset?: number | null;
  text?: string;
}

export default function ManualPolicy({ navigate }: { navigate: (v: string) => void }) {
  const [activeTab, setActiveTab] = useState<PolicyTab>('heuristic_policy.py');
  const [baselineCode, setBaselineCode] = useState<string>(BASELINE_TEMPLATE);
  const [heuristicCode, setHeuristicCode] = useState<string>(HEURISTIC_DAYPART_TEMPLATE);
  
  const [saveStatuses, setSaveStatuses] = useState<Record<PolicyTab, SaveStatus>>({
    'baseline_policy.py': 'saved',
    'heuristic_policy.py': 'saved',
  });

  const [validations, setValidations] = useState<Record<PolicyTab, ValidationResult>>({
    'baseline_policy.py': { valid: true, message: 'Python syntax & compute_bid signature valid' },
    'heuristic_policy.py': { valid: true, message: 'Python syntax & compute_bid signature valid' },
  });

  const debounceTimers = useRef<Record<PolicyTab, ReturnType<typeof setTimeout> | null>>({
    'baseline_policy.py': null,
    'heuristic_policy.py': null,
  });

  // Fetch initial file contents and server validation on mount
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
          if (data.validation) {
            setValidations(prev => ({ ...prev, 'baseline_policy.py': data.validation }));
          }
        }
        if (resHeur.ok) {
          const data = await resHeur.json();
          if (data.script && data.script.trim().length > 0) {
            setHeuristicCode(data.script);
          }
          if (data.validation) {
            setValidations(prev => ({ ...prev, 'heuristic_policy.py': data.validation }));
          }
        }
      } catch (e) {
        console.warn('Failed to load initial bidding scripts from server:', e);
      }
    };

    fetchScripts();
  }, []);

  // Handle immediate code change with debounced save & real Python validation
  const handleCodeChange = (newCode: string) => {
    if (activeTab === 'baseline_policy.py') {
      setBaselineCode(newCode);
    } else {
      setHeuristicCode(newCode);
    }

    // Instantly reflect unsaved state while typing
    setSaveStatuses(prev => ({ ...prev, [activeTab]: 'unsaved' }));

    // Reset debounce timer
    if (debounceTimers.current[activeTab]) {
      clearTimeout(debounceTimers.current[activeTab]!);
    }

    const currentTabToSave = activeTab;
    debounceTimers.current[currentTabToSave] = setTimeout(async () => {
      setSaveStatuses(prev => ({ ...prev, [currentTabToSave]: 'saving' }));
      try {
        const res = await fetch(`/campaign/script?file=${currentTabToSave}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: currentTabToSave, script: newCode }),
        });
        if (res.ok) {
          const data = await res.json();
          setSaveStatuses(prev => ({ ...prev, [currentTabToSave]: 'saved' }));
          if (data.validation) {
            setValidations(prev => ({ ...prev, [currentTabToSave]: data.validation }));
          }
        } else {
          setSaveStatuses(prev => ({ ...prev, [currentTabToSave]: 'unsaved' }));
        }
      } catch (e) {
        console.error(`Failed to auto-save ${currentTabToSave}:`, e);
        setSaveStatuses(prev => ({ ...prev, [currentTabToSave]: 'unsaved' }));
      }
    }, 600);
  };

  // Reset tab to default template and save immediately
  const handleResetCurrentTab = async () => {
    const template = activeTab === 'baseline_policy.py' ? BASELINE_TEMPLATE : HEURISTIC_DAYPART_TEMPLATE;
    if (activeTab === 'baseline_policy.py') {
      setBaselineCode(template);
    } else {
      setHeuristicCode(template);
    }

    if (debounceTimers.current[activeTab]) {
      clearTimeout(debounceTimers.current[activeTab]!);
    }

    setSaveStatuses(prev => ({ ...prev, [activeTab]: 'saving' }));
    try {
      const res = await fetch(`/campaign/script?file=${activeTab}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: activeTab, script: template }),
      });
      if (res.ok) {
        const data = await res.json();
        setSaveStatuses(prev => ({ ...prev, [activeTab]: 'saved' }));
        if (data.validation) {
          setValidations(prev => ({ ...prev, [activeTab]: data.validation }));
        }
      } else {
        setSaveStatuses(prev => ({ ...prev, [activeTab]: 'unsaved' }));
      }
    } catch (e) {
      console.error(`Failed to reset and save ${activeTab}:`, e);
      setSaveStatuses(prev => ({ ...prev, [activeTab]: 'unsaved' }));
    }
  };

  const currentCode = activeTab === 'baseline_policy.py' ? baselineCode : heuristicCode;
  const currentStatus = saveStatuses[activeTab];
  const currentValidation = validations[activeTab];
  const canProceed = validations['heuristic_policy.py'].valid;

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
            disabled={!canProceed}
            className={`px-6 py-2.5 font-bold rounded-xl text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
              canProceed 
                ? 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black hover:shadow-vibe-cyan/20' 
                : 'bg-overlay text-fg-muted border border-hairline cursor-not-allowed opacity-60'
            }`}
            title={canProceed ? 'Proceed to Step 4: Heuristic Simulation' : 'Fix Python syntax errors before proceeding'}
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
                {!validations['baseline_policy.py'].valid && (
                  <span className="w-2 h-2 rounded-full bg-red-400" title="Syntax error" />
                )}
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
                {!validations['heuristic_policy.py'].valid && (
                  <span className="w-2 h-2 rounded-full bg-red-400" title="Syntax error" />
                )}
              </button>
            </div>

            {/* Auto-save status & Reset Controls */}
            <div className="flex items-center gap-3 pr-1">
              {/* Dynamic Auto-save Indicator */}
              <div className="text-[11px] font-mono flex items-center gap-1.5 min-w-[110px]">
                {currentStatus === 'unsaved' && (
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Unsaved...</span>
                  </div>
                )}
                {currentStatus === 'saving' && (
                  <div className="flex items-center gap-1.5 text-vibe-cyan">
                    <Loader2 size={12} className="animate-spin text-vibe-cyan" />
                    <span>Saving...</span>
                  </div>
                )}
                {(currentStatus === 'saved' || currentStatus === 'idle') && (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Check size={12} />
                    <span>Saved</span>
                  </div>
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
              onChange={handleCodeChange}
              className="min-h-[420px]"
            />
          </div>

          {/* Real Python Syntax Validation Error Banner */}
          {!currentValidation.valid && (
            <div className="p-5 bg-red-950/50 border-2 border-red-500/70 rounded-2xl flex items-start gap-3.5 animate-rise shadow-2xl">
              <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0 mt-0.5 border border-red-500/40">
                <AlertTriangle size={20} />
              </div>
              <div className="space-y-2 flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-bold text-red-200 flex items-center gap-2">
                    <span>Python Syntax Error in</span>
                    <code className="bg-black/60 px-2 py-0.5 rounded text-white font-mono border border-white/10">{activeTab}</code>
                    {currentValidation.line && (
                      <span className="px-2 py-0.5 rounded bg-red-500/30 text-white font-mono text-[11px] font-bold border border-red-500/50">
                        Line {currentValidation.line}
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-xs font-mono text-white bg-black/80 p-3.5 rounded-xl border border-red-500/30 overflow-x-auto whitespace-pre-wrap font-medium leading-relaxed">
                  <div className="text-red-300 font-semibold">{currentValidation.message}</div>
                  {currentValidation.text && (
                    <div className="mt-2 pt-2 border-t border-white/10 text-zinc-300">
                      &gt; {currentValidation.text}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Validation & Execution Status Footer */}
          <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs font-mono transition-colors ${
            currentValidation.valid 
              ? 'bg-overlay/60 border-hairline' 
              : 'bg-red-950/40 border-red-500/50'
          }`}>
            <div className="flex items-center gap-1.5">
              {currentValidation.valid ? (
                <span className="text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Python 3 Syntax Validated
                </span>
              ) : (
                <span className="text-red-300 flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={14} className="text-red-400" />
                  <span>Syntax Error {currentValidation.line ? `on Line ${currentValidation.line}` : ''}: <span className="text-white font-medium">{currentValidation.message}</span></span>
                </span>
              )}
            </div>
            <span className="text-fg-muted"><code>policies/{activeTab}</code></span>
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
    </div>
  );
}
