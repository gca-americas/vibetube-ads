import { useState, useEffect, useRef } from 'react';
import { 
  Database, Terminal, ArrowRight, FileCode, Check, Loader2,
  CheckCircle2, AlertTriangle, Sparkles, BarChart3, RotateCcw
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';
import Simulator from './Simulator';

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

interface DaypartInsight {
  daypart: string;
  hours: string;
  icon: string;
  name: string;
  p90: string;
  volume: string;
  volatility: string;
  rule: string;
  badgeClass: string;
}

const BQ_DAYPART_INSIGHTS: DaypartInsight[] = [
  {
    daypart: 'late_night',
    hours: '00:00 – 06:00',
    icon: '🌙',
    name: 'Late-Night Cooldown',
    p90: '$0.90',
    volume: '85,000',
    volatility: '±$0.12',
    rule: '0.90 CPM (shade bid off-peak)',
    badgeClass: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  },
  {
    daypart: 'morning',
    hours: '06:00 – 12:00',
    icon: '☀️',
    name: 'Morning Ramp-Up',
    p90: '$2.40',
    volume: '150,000',
    volatility: '±$0.25',
    rule: '2.40 CPM (steady stream flow)',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  },
  {
    daypart: 'lunch',
    hours: '12:00 – 14:00',
    icon: '🥪',
    name: 'Lunch Rush Peak',
    p90: '$4.40',
    volume: '50,000',
    volatility: '±$0.48',
    rule: '4.40 CPM (midday traffic surge)',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  },
  {
    daypart: 'afternoon',
    hours: '14:00 – 17:00',
    icon: '⚔️',
    name: 'Afternoon Bidding War',
    p90: '$3.55',
    volume: '75,000',
    volatility: '±$0.62',
    rule: '3.55 CPM (avoid bot exhaustion)',
    badgeClass: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  },
  {
    daypart: 'primetime',
    hours: '17:00 – 22:00',
    icon: '⚡',
    name: 'Primetime Peak',
    p90: '$9.65',
    volume: '125,000',
    volatility: '±$0.85',
    rule: 'min(9.65, ceiling) (win premium)',
    badgeClass: 'bg-red-500/10 text-red-400 border-red-500/30',
  },
];

const BQ_SQL_QUERY = `SELECT daypart,
       COUNT(1) AS auction_volume,
       APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(90)] AS market_price_cpm,
       ROUND(AVG(win), 3) AS win_rate,
       ROUND(STDDEV(competitor_highest_bid_cpm), 2) AS price_volatility
FROM \`vibeflix-sandbox.vibetube_telemetry.auction_events\`
GROUP BY daypart
ORDER BY market_price_cpm ASC;`;


export default function ManualPolicy({ navigate, activeLab }: { navigate: (v: string) => void; activeLab?: string }) {
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

    if (activeLab === 'manual_policy' || activeLab === 'policy' || activeLab === 'simulator2' || !activeLab) {
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

  const canProceed = validation.valid;
  const isModified = heuristicCode.trim() !== DEFAULT_HEURISTIC_CODE.trim();

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-fg">Manual Policy & Heuristic Simulation</h1>
          <p className="text-xs text-fg-muted mt-1 font-mono">
            Explore BigQuery telemetry percentiles, author daypart bidding heuristics, and test them live in the auction simulation.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('ai_engineer')}
            disabled={!canProceed}
            className={`px-6 py-2.5 font-bold rounded-xl text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
              canProceed 
                ? 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black hover:shadow-vibe-cyan/20' 
                : 'bg-overlay text-fg-muted border border-hairline cursor-not-allowed opacity-60'
            }`}
            title={canProceed ? 'Proceed to Step 4: AI Data Engineer' : 'Fix Python syntax errors before proceeding'}
          >
            <span>Proceed to AI Engineer</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* 1. BigQuery Telemetry Exploration Section */}
      <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-vibe-cyan/10 text-vibe-cyan border border-vibe-cyan/20">
              <Database size={18} />
            </div>
            <div>
              <h2 className="text-base font-bold text-fg">BigQuery Telemetry Exploration</h2>
              <span className="text-xs font-mono text-fg-muted">
                vibeflix-sandbox.vibetube_telemetry.auction_events · 600,000 auctions
              </span>
            </div>
          </div>
          <span className="text-xs font-mono px-3 py-1 rounded-full bg-vibe-cyan/10 text-vibe-cyan border border-vibe-cyan/20 font-semibold self-start sm:self-auto">
            Analytical Foundation
          </span>
        </div>

        <p className="text-xs text-fg-muted leading-relaxed">
          Before hand-coding bidding heuristics, data engineers query historical auction telemetry in BigQuery to discover market clearing prices across dayparts. Notice how competitor P90 prices range from <strong className="text-fg font-semibold">$0.90</strong> at midnight up to <strong className="text-fg font-semibold">$9.65</strong> in primetime.
        </p>

        {/* BigQuery SQL Query + Daypart Findings Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* SQL Query Card (col-span-5) */}
          <div className="lg:col-span-5 bg-overlay/80 border border-hairline rounded-2xl p-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-fg-muted border-b border-hairline/60 pb-1.5">
              <span className="flex items-center gap-1.5 text-vibe-cyan">
                <Database size={13} /> Analytical SQL Query
              </span>
              <span className="text-[10px] text-fg-muted/70">Google Cloud BigQuery</span>
            </div>
            <pre className="text-[11px] font-mono text-fg-muted leading-relaxed overflow-x-auto whitespace-pre">
              {BQ_SQL_QUERY}
            </pre>
          </div>

          {/* Daypart Findings Table / Cards (col-span-7) */}
          <div className="lg:col-span-7 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-fg-muted px-1">
              <span className="flex items-center gap-1.5 text-fg">
                <BarChart3 size={13} className="text-amber-400" /> Empirical P90 Clearing Prices Discovered
              </span>
              <span className="text-[10px] text-fg-muted">Target Bid Rule</span>
            </div>

            <div className="space-y-1.5">
              {BQ_DAYPART_INSIGHTS.map((item) => (
                <div
                  key={item.daypart}
                  className="p-2.5 px-3 bg-overlay/60 hover:bg-overlay border border-hairline rounded-xl flex items-center justify-between gap-3 text-xs transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base select-none shrink-0">{item.icon}</span>
                    <div className="min-w-0">
                      <div className="font-medium text-fg flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-semibold">{item.name}</span>
                        <code className="text-[10px] font-mono text-fg-muted">({item.hours})</code>
                      </div>
                      <div className="text-[11px] text-fg-muted font-mono flex items-center gap-2">
                        <span>P90: <strong className="text-fg font-bold">{item.p90} CPM</strong></span>
                        <span>·</span>
                        <span>{item.volume} aucs</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className={`text-[11px] font-mono px-2 py-0.5 rounded-lg border font-semibold ${item.badgeClass}`}>
                      {item.rule}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Insight Callout Banner */}
        <div className="p-3.5 bg-vibe-cyan/5 border border-vibe-cyan/20 rounded-2xl flex items-center gap-3">
          <Sparkles size={16} className="text-vibe-cyan shrink-0" />
          <p className="text-xs text-fg-muted leading-relaxed">
            <strong className="text-fg font-semibold">Data Engineering Specification:</strong> Instead of the naive flat bid ($2.50) from Step 2, the policy below hand-codes daypart branches directly from these empirical BigQuery numbers.
          </p>
        </div>
      </div>

      {/* 2. Main Grid: Heuristic Code Editor + Context Reference */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Heuristic Python Code Editor (col-span-8) */}
        <div className="lg:col-span-8 space-y-4">
          {/* File Header Bar & Status */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-2 px-3 rounded-2xl border border-hairline">
            <div className="flex items-center gap-2">
              <FileCode size={16} className="text-vibe-cyan" />
              <span className="text-xs font-mono font-bold text-fg">heuristic_policy.py</span>
              <span className="text-[11px] font-mono text-fg-muted">(Daypart Rule-Based Policy)</span>
            </div>

            {/* Auto-save status & Reset Controls */}
            <div className="flex items-center gap-3 pr-1">
              {/* Dynamic Auto-save Indicator */}
              <div className="text-[11px] font-mono flex items-center gap-1.5 min-w-[100px]">
                {saveStatus === 'unsaved' && (
                  <div className="flex items-center gap-1.5 text-amber-300">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span>Unsaved...</span>
                  </div>
                )}
                {saveStatus === 'saving' && (
                  <div className="flex items-center gap-1.5 text-vibe-cyan">
                    <Loader2 size={12} className="animate-spin text-vibe-cyan" />
                    <span>Saving...</span>
                  </div>
                )}
                {(saveStatus === 'saved' || saveStatus === 'idle') && (
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <Check size={12} />
                    <span>Saved</span>
                  </div>
                )}
              </div>

              {isModified && (
                <button
                  type="button"
                  onClick={handleResetCode}
                  className="px-2.5 py-1 bg-overlay hover:bg-hairline text-fg-muted hover:text-fg rounded-lg text-[11px] font-mono transition-all flex items-center gap-1 cursor-pointer border border-hairline"
                  title="Reset code to recommended heuristic"
                >
                  <RotateCcw size={11} />
                  <span>Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Code Editor Body */}
          <div className="rounded-2xl overflow-hidden border border-hairline shadow-2xl bg-card">
            <PythonCodeHighlight
              code={heuristicCode}
              filename="heuristic_policy.py"
              editable={true}
              onChange={handleCodeChange}
              onReset={handleResetCode}
              isModified={isModified}
              className="min-h-[380px]"
            />
          </div>

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
                      <span className="px-2 py-0.5 rounded bg-red-500/30 text-white font-mono text-[11px] font-bold border border-red-500/50">
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
              ? 'bg-overlay/60 border-hairline' 
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

        {/* Right Column: Context Reference (lib.models.AuctionContext) (col-span-4) */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-4">
            <div className="flex items-center gap-2 border-b border-hairline pb-3">
              <Terminal size={16} className="text-vibe-cyan" />
              <div>
                <h3 className="text-sm font-bold text-fg">Available Context Fields</h3>
                <span className="text-[11px] font-mono text-fg-muted">lib.models.AuctionContext</span>
              </div>
            </div>

            <div className="space-y-2.5 font-mono text-xs max-h-[520px] overflow-y-auto pr-1">
              {/* context.daypart */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-vibe-cyan font-bold">context.daypart <span className="text-fg-muted text-[10px] font-normal">(str)</span></div>
                <div className="text-fg-muted text-[11px] leading-relaxed">
                  Market regime: <code className="text-amber-300">"morning"</code>, <code className="text-amber-300">"lunch"</code>, <code className="text-amber-300">"afternoon"</code>, <code className="text-amber-300">"primetime"</code>, <code className="text-amber-300">"late_night"</code>.
                </div>
              </div>

              {/* context.max_bid_ceiling */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-purple-400 font-bold">context.max_bid_ceiling <span className="text-fg-muted text-[10px] font-normal">(float)</span></div>
                <div className="text-fg-muted text-[11px]">Hard safety guardrail ceiling in USD CPM (e.g. $10.00).</div>
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

              {/* context.win_rate */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-amber-400 font-bold">context.win_rate <span className="text-fg-muted text-[10px] font-normal">(float)</span></div>
                <div className="text-fg-muted text-[11px]">Trailing win rate ratio (0.0 to 1.0) from recent auction ticks.</div>
              </div>

              {/* context.market_price / p90 */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-rose-400 font-bold">context.market_price <span className="text-fg-muted text-[10px] font-normal">(or .p90)</span></div>
                <div className="text-fg-muted text-[11px]">Competitor market price benchmark to beat in USD CPM.</div>
              </div>

              {/* context.market_price_history */}
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <div className="text-indigo-400 font-bold">context.market_price_history <span className="text-fg-muted text-[10px] font-normal">(list[float])</span></div>
                <div className="text-fg-muted text-[11px]">Trailing sequence of recent market prices for momentum velocity.</div>
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

      {/* 3. Embedded Simulation Runner (Attempt 2: Heuristic Simulation) */}
      <Simulator navigate={navigate} activeLab={activeLab} attempt={2} embedded={true} />
    </div>
  );
}

