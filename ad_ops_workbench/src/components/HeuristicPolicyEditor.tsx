import { useState, useEffect, useRef } from 'react';
import { 
  Terminal, Check, Loader2,
  CheckCircle2, AlertTriangle
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';

type SaveStatus = 'idle' | 'unsaved' | 'saving' | 'saved';

interface ValidationResult {
  valid: boolean;
  message: string;
  error_type?: string;
  line?: number | null;
  offset?: number | null;
  text?: string;
}

const DEFAULT_HEURISTIC_CODE = `"""Vibetube Ads - Hand-Coded Dayparting Heuristic
Authored by Data Engineer to handle daypart traffic waves.
"""

from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    daypart = context.daypart
    ceiling = context.max_bid_ceiling
    
    if daypart == "primetime":
        return min(9.65, ceiling)
    elif daypart == "late_night":
        return 0.90
    elif daypart == "lunch":
        return 4.40
    elif daypart == "afternoon":
        return 3.55
    else:
        return 2.40
`;

interface HeuristicPolicyEditorProps {
  activeLab?: string;
  className?: string;
}

export default function HeuristicPolicyEditor({ activeLab, className = '' }: HeuristicPolicyEditorProps) {
  const [heuristicCode, setHeuristicCode] = useState<string>(DEFAULT_HEURISTIC_CODE);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [validation, setValidation] = useState<ValidationResult>({
    valid: true,
    message: 'Python syntax & compute_bid signature valid',
  });

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const fetchScript = async () => {
      try {
        const res = await fetch('/campaign/script?file=heuristic_policy.py');
        if (res.ok) {
          const data = await res.json();
          if (data.script && data.script.trim().length > 0) {
            setHeuristicCode(data.script);
          }
          if (data.validation) {
            setValidation(data.validation);
          }
        }
      } catch (e) {
        console.warn('Failed to load heuristic_policy.py:', e);
      }
    };

    if (activeLab === 'manual_policy' || activeLab === 'data_exploration' || activeLab === 'policy' || activeLab === 'simulator2' || !activeLab) {
      fetchScript();
    }
  }, [activeLab]);

  const handleCodeChange = (newCode: string) => {
    setHeuristicCode(newCode);
    setSaveStatus('unsaved');

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        const res = await fetch('/campaign/script?file=heuristic_policy.py', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: 'heuristic_policy.py', script: newCode }),
        });
        if (res.ok) {
          const data = await res.json();
          setSaveStatus('saved');
          if (data.validation) {
            setValidation(data.validation);
          }
        } else {
          setSaveStatus('unsaved');
        }
      } catch (e) {
        console.error('Failed to auto-save heuristic_policy.py:', e);
        setSaveStatus('unsaved');
      }
    }, 600);
  };

  const handleResetCode = () => {
    handleCodeChange(DEFAULT_HEURISTIC_CODE);
  };

  const isModified = heuristicCode.trim() !== DEFAULT_HEURISTIC_CODE.trim();

  const renderSaveStatus = () => {
    if (saveStatus === 'unsaved') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
          <span className="w-2 h-2 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse" />
          <span>Unsaved...</span>
        </div>
      );
    }
    if (saveStatus === 'saving') {
      return (
        <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg bg-cyan-500/10 text-cyan-800 dark:text-vibe-cyan border border-cyan-500/30">
          <Loader2 size={12} className="animate-spin text-cyan-700 dark:text-vibe-cyan" />
          <span>Saving...</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
        <Check size={12} className="text-emerald-600 dark:text-emerald-400" />
        <span>Saved</span>
      </div>
    );
  };

  return (
    <div className={`p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-6 ${className}`}>
      {/* 1. Top Section: Available Context Fields (lib.models.AuctionContext) */}
      <div className="p-5 bg-overlay/80 rounded-2xl border border-hairline space-y-3.5">
        <div className="flex items-center gap-2 border-b border-hairline/60 pb-3">
          <Terminal size={17} className="text-cyan-700 dark:text-vibe-cyan" />
          <div>
            <h3 className="text-sm font-bold text-fg">Available Context Fields</h3>
            <span className="text-xs font-mono text-fg-muted">lib.models.AuctionContext</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* context.daypart */}
          <div className="p-3 bg-card rounded-xl border border-hairline space-y-1">
            <div className="text-sm font-bold font-mono text-blue-700 dark:text-sky-400">
              context.daypart <span className="text-xs font-normal text-fg-muted">(str)</span>
            </div>
            <div className="text-xs text-fg-muted leading-relaxed">
              Market regime: <code className="text-amber-800 dark:text-amber-300 font-semibold font-mono">"morning"</code>, <code className="text-amber-800 dark:text-amber-300 font-semibold font-mono">"lunch"</code>, <code className="text-amber-800 dark:text-amber-300 font-semibold font-mono">"afternoon"</code>, <code className="text-amber-800 dark:text-amber-300 font-semibold font-mono">"primetime"</code>, <code className="text-amber-800 dark:text-amber-300 font-semibold font-mono">"late_night"</code>.
            </div>
          </div>

          {/* context.max_bid_ceiling */}
          <div className="p-3 bg-card rounded-xl border border-hairline space-y-1">
            <div className="text-sm font-bold font-mono text-purple-700 dark:text-purple-400">
              context.max_bid_ceiling <span className="text-xs font-normal text-fg-muted">(float)</span>
            </div>
            <div className="text-xs text-fg-muted leading-relaxed">Hard safety guardrail ceiling in USD CPM (e.g. $10.00).</div>
          </div>

          {/* context.budget_remaining */}
          <div className="p-3 bg-card rounded-xl border border-hairline space-y-1">
            <div className="text-sm font-bold font-mono text-emerald-700 dark:text-emerald-400">
              context.budget_remaining <span className="text-xs font-normal text-fg-muted">(float)</span>
            </div>
            <div className="text-xs text-fg-muted leading-relaxed">Unspent campaign budget remaining in USD (e.g. $2500.00).</div>
          </div>

          {/* context.hours_remaining */}
          <div className="p-3 bg-card rounded-xl border border-hairline space-y-1">
            <div className="text-sm font-bold font-mono text-sky-700 dark:text-sky-400">
              context.hours_remaining <span className="text-xs font-normal text-fg-muted">(float)</span>
            </div>
            <div className="text-xs text-fg-muted leading-relaxed">Flight time remaining in hours (24.0h down to 0.0h).</div>
          </div>

          {/* context.win_rate */}
          <div className="p-3 bg-card rounded-xl border border-hairline space-y-1">
            <div className="text-sm font-bold font-mono text-amber-700 dark:text-amber-400">
              context.win_rate <span className="text-xs font-normal text-fg-muted">(float)</span>
            </div>
            <div className="text-xs text-fg-muted leading-relaxed">Trailing win rate ratio (0.0 to 1.0) from recent auction ticks.</div>
          </div>

          {/* context.market_price */}
          <div className="p-3 bg-card rounded-xl border border-hairline space-y-1">
            <div className="text-sm font-bold font-mono text-rose-700 dark:text-rose-400">
              context.market_price <span className="text-xs font-normal text-fg-muted">(float)</span>
            </div>
            <div className="text-xs text-fg-muted leading-relaxed">Competitor market price benchmark to beat in USD CPM.</div>
          </div>

          {/* context.market_price_history */}
          <div className="p-3 bg-card rounded-xl border border-hairline space-y-1">
            <div className="text-sm font-bold font-mono text-indigo-700 dark:text-indigo-400">
              context.market_price_history <span className="text-xs font-normal text-fg-muted">(list[float])</span>
            </div>
            <div className="text-xs text-fg-muted leading-relaxed">Trailing sequence of recent market prices for momentum velocity.</div>
          </div>

          {/* context.win_rate_history */}
          <div className="p-3 bg-card rounded-xl border border-hairline space-y-1">
            <div className="text-sm font-bold font-mono text-teal-700 dark:text-teal-400">
              context.win_rate_history <span className="text-xs font-normal text-fg-muted">(list[float])</span>
            </div>
            <div className="text-xs text-fg-muted leading-relaxed">Trailing sequence of recent win rates over recent ticks.</div>
          </div>

          {/* context.active_bid_cpm */}
          <div className="p-3 bg-card rounded-xl border border-hairline space-y-1">
            <div className="text-sm font-bold font-mono text-blue-700 dark:text-blue-300">
              context.active_bid_cpm <span className="text-xs font-normal text-fg-muted">(float | None)</span>
            </div>
            <div className="text-xs text-fg-muted leading-relaxed">The CPM bid price submitted from the preceding tick.</div>
          </div>
        </div>
      </div>

      {/* 2. Bottom Section: Heuristic Python Code Editor & Syntax Validation (Full Width) */}
      <div className="space-y-4">
        {/* Code Editor */}
        <PythonCodeHighlight
          code={heuristicCode}
          filename="heuristic_policy.py"
          editable={true}
          onChange={handleCodeChange}
          onReset={handleResetCode}
          isModified={isModified}
          showCopy={false}
          statusSlot={renderSaveStatus()}
          className="min-h-[420px] w-full"
        />

        {/* Real Python Syntax Validation Error Banner */}
        {!validation.valid && (
          <div className="p-5 bg-red-950/50 border-2 border-red-500/70 rounded-2xl flex items-start gap-3.5 animate-rise shadow-2xl">
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0 mt-0.5 border border-red-500/40">
              <AlertTriangle size={20} />
            </div>
            <div className="space-y-2 flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs font-bold text-red-200 flex items-center gap-2">
                  <span>Python Syntax Error in</span>
                  <code className="bg-black/60 px-2 py-0.5 rounded text-white font-mono border border-white/10">heuristic_policy.py</code>
                  {validation.line && (
                    <span className="px-2 py-0.5 rounded bg-red-500/30 text-white font-mono text-xs font-bold border border-red-500/50">
                      Line {validation.line}
                    </span>
                  )}
                </span>
              </div>
              <div className="text-xs font-mono text-white bg-black/80 p-3.5 rounded-xl border border-red-500/30 overflow-x-auto whitespace-pre-wrap font-medium leading-relaxed">
                <div className="text-red-300 font-semibold">{validation.message}</div>
                {validation.text && (
                  <div className="mt-2 pt-2 border-t border-white/10 text-zinc-300">
                    &gt; {validation.text}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Validation & Execution Status Footer */}
        <div className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs font-mono transition-colors ${
          validation.valid 
            ? 'bg-overlay/80 border-hairline' 
            : 'bg-red-950/40 border-red-500/50'
        }`}>
          <div className="flex items-center gap-1.5">
            {validation.valid ? (
              <span className="text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Python 3 Syntax Validated
              </span>
            ) : (
              <span className="text-red-300 flex items-center gap-1.5 font-semibold">
                <AlertTriangle size={14} className="text-red-400" />
                <span>Syntax Error {validation.line ? `on Line ${validation.line}` : ''}: <span className="text-white font-medium">{validation.message}</span></span>
              </span>
            )}
          </div>
          <span className="text-fg-muted"><code>policies/heuristic_policy.py</code></span>
        </div>
      </div>
    </div>
  );
}
