import { useState } from 'react';
import { 
  Terminal, Code2,
  ArrowRight, Bot, Check, CheckCircle2,
  Play, RefreshCw, Database, Cpu, FileCode2
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';

const AI_GENERATED_PYTHON_SCRIPT = `"""Vibetube Ads - AI-Optimized Adaptive Bidding Policy
Authored by ADK Bidding Policy Agent via Google Cloud BigQuery Data Engineering Agent.
"""

from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    # 1. Base clearing floor derived from BigQuery Telemetry
    base_p90 = context.p90
    ceiling = context.max_bid_ceiling
    budget = context.budget_remaining
    hours = max(0.5, context.hours_remaining)

    # 2. Dynamic Budget Pacing Multiplier (Target: ~$104.16 / hour)
    target_hourly = budget / hours
    pacing_factor = min(1.25, max(0.70, target_hourly / 104.16))

    # 3. Dynamic Clearing & Bid Shading across Dayparts
    if context.daypart == "late_night":
        # Midnight cooldown: shade bid near clearing floor ($0.93 P90)
        return min(0.95 * pacing_factor, ceiling)
    elif context.daypart == "primetime":
        # Evening peak: bid aggressively near floor with pacing adjustment
        return min((base_p90 + 0.05) * pacing_factor, ceiling)
    elif context.daypart == "afternoon":
        # Afternoon surge: track competitive clearing price
        return min((base_p90 + 0.05) * pacing_factor, ceiling)
    else:
        # Morning / Lunch: moderate clearing bid
        return min(2.50 * pacing_factor, ceiling)`;

export default function AgentExecution({ navigate }: { navigate: (v: string) => void }) {
  const [isRunning, setIsRunning] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [deploying, setDeploying] = useState(false);

  const handleRunAgent = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setCompleted(false);
    setStepIndex(1);

    // Step 1: Tool Call 1 (get_campaign_info)
    await new Promise(r => setTimeout(r, 1200));
    setStepIndex(2);

    // Step 2: Tool Call 2 (DataAgentToolset / ask_data_agent on GCP BigQuery Agent)
    await new Promise(r => setTimeout(r, 1600));
    setStepIndex(3);

    // Step 3: Policy Synthesis & Compilation
    await new Promise(r => setTimeout(r, 1400));
    setStepIndex(4);

    // Step 4: Tool Call 3 (deploy_bidding_policy)
    await new Promise(r => setTimeout(r, 1200));
    setStepIndex(5);

    setIsRunning(false);
    setCompleted(true);
  };

  const handleDeployAndProceed = async () => {
    setDeploying(true);
    try {
      await fetch('/campaign/script?file=agent_bidding_policy.py', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'agent_bidding_policy.py', script: AI_GENERATED_PYTHON_SCRIPT }),
      });
      navigate('adk_eval');
    } catch (e) {
      console.error('Failed to deploy AI script:', e);
      navigate('adk_eval');
    } finally {
      setDeploying(false);
    }
  };

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-fg">
            Execute Bidding Policy Agent
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Trigger the ADK 2.0 reasoning engine to query BigQuery telemetry, formulate market formulas, and deploy the bidding policy.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isRunning ? (
            <div className="px-5 py-2.5 bg-card text-fg-muted border border-hairline rounded-xl text-xs font-mono font-medium flex items-center gap-2">
              <RefreshCw size={14} className="animate-spin text-vibe-cyan" />
              <span>Executing Trajectory...</span>
            </div>
          ) : completed ? (
            <>
              <button
                onClick={handleRunAgent}
                className="px-4 py-2.5 bg-card hover:bg-overlay text-fg text-xs font-mono font-medium rounded-xl border border-hairline transition-all flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <RefreshCw size={14} />
                <span>Re-Execute Workflow</span>
              </button>

              <button
                onClick={handleDeployAndProceed}
                disabled={deploying}
                className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <span>{deploying ? 'Deploying...' : 'Proceed to Agent Evaluation'}</span>
                <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <button
              onClick={handleRunAgent}
              className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Play size={15} className="fill-black" />
              <span>Execute Bidding Policy Agent</span>
            </button>
          )}
        </div>
      </div>

      {/* Multi-Agent Trajectory Workflow Container */}
      <div className="space-y-4 animate-rise">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
            <Terminal size={15} className="text-vibe-cyan" />
            <span>Multi-Agent Trajectory Workflow</span>
          </div>
          {completed ? (
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 font-bold shadow-sm">
              <Check size={13} /> Trajectory Complete
            </span>
          ) : stepIndex === 0 ? (
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-overlay text-fg-muted border border-hairline">
              Ready to Execute
            </span>
          ) : (
            <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-vibe-cyan/15 text-cyan-800 dark:text-vibe-cyan border border-vibe-cyan/30 flex items-center gap-1.5 font-bold">
              <RefreshCw size={12} className="animate-spin" /> Step {stepIndex} of 4 Executing
            </span>
          )}
        </div>

        <div className="p-6 bg-card rounded-3xl border border-hairline shadow-2xl space-y-4 font-mono text-xs">
          {/* Step 1: get_campaign_info */}
          <div className={`p-5 rounded-2xl border transition-all ${
            stepIndex === 0 && !completed
              ? 'bg-card/40 border-dashed border-hairline opacity-60 text-fg-muted'
              : stepIndex >= 1
                ? 'bg-card border-emerald-500/40 text-fg shadow-sm'
                : 'bg-card/40 border-hairline text-fg-muted opacity-50'
          }`}>
            <div className="flex items-start gap-4">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                stepIndex > 1 
                  ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' 
                  : stepIndex === 1 
                    ? 'bg-vibe-cyan border-vibe-cyan text-black animate-pulse shadow-md' 
                    : 'bg-overlay border-hairline text-fg-muted'
              }`}>
                {stepIndex > 1 ? <Check size={16} /> : <Database size={16} />}
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm flex items-center gap-1.5 ${
                    stepIndex >= 1 ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'font-bold text-fg-muted'
                  }`}>
                    1. <code className="font-mono bg-overlay px-1.5 py-0.5 rounded text-xs">get_campaign_info()</code> — Ad Server State Reader
                  </span>
                  <span className="text-[11px] font-mono text-fg-muted">REST Endpoint</span>
                </div>
                <p className="text-fg-muted text-xs font-sans leading-relaxed">
                  {stepIndex === 0 && !completed ? (
                    <span>Queries ad server for live campaign parameters (budget, flight duration, bid ceilings). Click "Execute Bidding Policy Agent" above to start.</span>
                  ) : stepIndex === 1 ? (
                    <span className="text-vibe-cyan animate-pulse">Connecting to ad server REST API (/campaign/config)...</span>
                  ) : (
                    <span>Retrieved live campaign state: <strong className="text-fg">$2,500.00 Total Budget</strong>, <strong className="text-fg">24.0-hour flight window</strong>, and <strong className="text-fg">$10.00 Max Bid Ceiling</strong>.</span>
                  )}
                </p>

                {/* Detailed Payload: Only shown once step 1 has executed */}
                {(stepIndex >= 2 || completed) && (
                  <div className="mt-3 p-3 bg-overlay rounded-xl border border-hairline font-mono text-xs space-y-1.5 animate-rise">
                    <div className="flex items-center justify-between text-[10px] text-fg-muted uppercase tracking-wider font-bold border-b border-hairline/60 pb-1">
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">GET /campaign/config Response Payload</span>
                      <span className="text-emerald-600 dark:text-emerald-400">HTTP 200 OK</span>
                    </div>
                    <pre className="text-fg leading-relaxed overflow-x-auto text-[11px]">
{`{
  "total_budget": 2500.00,
  "flight_duration_hours": 24.0,
  "max_bid_ceiling": 10.00,
  "base_bid_cpm": 2.50,
  "currency": "USD"
}`}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 2: BigQuery Data Agent A2A */}
          {stepIndex >= 2 && (
            <div className="p-5 rounded-2xl border transition-all space-y-3 bg-card border-vibe-cyan/40 text-fg shadow-sm animate-rise">
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                  stepIndex > 2 
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' 
                    : 'bg-vibe-cyan border-vibe-cyan text-black animate-pulse shadow-md'
                }`}>
                  {stepIndex > 2 ? <Check size={16} /> : <Bot size={16} />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-700 dark:text-vibe-cyan text-sm flex items-center gap-1.5">
                      2. <code className="font-mono bg-vibe-cyan/10 px-1.5 py-0.5 rounded text-xs">data_agent_toolset</code> (A2A) — BigQuery Data Engineering Agent
                    </span>
                    <span className="text-[11px] font-mono text-fg-muted">Agent-to-Agent</span>
                  </div>
                  <p className="text-fg-muted text-xs font-sans leading-relaxed">
                    Dispatched natural language analytical intent to Google Cloud's BigQuery Data Engineering Agent over A2A:
                  </p>
                </div>
              </div>

              <div className="pl-12 space-y-3 pt-1">
                {/* Natural Language Prompt Bubble */}
                <div className="p-3 bg-overlay rounded-xl border border-hairline font-sans text-xs text-fg flex items-start gap-2.5">
                  <span className="text-[10px] font-mono font-bold uppercase text-cyan-800 dark:text-vibe-cyan px-2 py-0.5 rounded bg-vibe-cyan/15 border border-vibe-cyan/30 shrink-0">
                    A2A Intent
                  </span>
                  <span className="italic text-fg-muted">
                    "Analyze historical auction telemetry in BigQuery and return the P90 clearing floors, win rates, and volume distributions across all diurnal dayparts."
                  </span>
                </div>

                {/* Under the Hood: BigQuery SQL Generated by Data Agent */}
                <div className="p-3 bg-overlay rounded-xl border border-hairline font-mono text-[11px] space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-fg-muted uppercase tracking-wider font-bold border-b border-hairline/60 pb-1">
                    <span className="flex items-center gap-1.5 text-cyan-700 dark:text-vibe-cyan font-bold">
                      <Database size={12} /> BigQuery SQL Generated by Data Agent
                    </span>
                    <span className="text-fg-muted">telemetry.auction_events</span>
                  </div>
                  <pre className="text-fg-muted leading-relaxed overflow-x-auto text-[11px]">
{`SELECT daypart,
       APPROX_QUANTILES(clearing_cpm, 100)[OFFSET(90)] AS p90_clearing_cpm,
       ROUND(AVG(is_win), 3) AS win_rate,
       COUNT(1) AS auction_volume
FROM \`vibeflix-sandbox.telemetry.auction_events\`
GROUP BY daypart
ORDER BY p90_clearing_cpm ASC;`}
                  </pre>
                </div>

                {/* Structured Returned Insights Grid */}
                <div className="space-y-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-fg-muted block">
                    Returned Structured Telemetry Insights:
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    <div className="p-3 bg-card rounded-xl border border-hairline shadow-sm space-y-0.5">
                      <span className="text-[10px] font-mono text-fg-muted uppercase block">Late Night</span>
                      <div className="text-sm font-bold font-mono text-fg">$0.93 <span className="text-[10px] font-normal text-fg-muted">P90</span></div>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 block">91.2% Win Rate</span>
                    </div>
                    <div className="p-3 bg-card rounded-xl border border-hairline shadow-sm space-y-0.5">
                      <span className="text-[10px] font-mono text-fg-muted uppercase block">Morning / Lunch</span>
                      <div className="text-sm font-bold font-mono text-fg">$2.40 <span className="text-[10px] font-normal text-fg-muted">P90</span></div>
                      <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 block">78.4% Win Rate</span>
                    </div>
                    <div className="p-3 bg-card rounded-xl border border-hairline shadow-sm space-y-0.5">
                      <span className="text-[10px] font-mono text-fg-muted uppercase block">Afternoon Surge</span>
                      <div className="text-sm font-bold font-mono text-fg">$5.90 <span className="text-[10px] font-normal text-fg-muted">P90</span></div>
                      <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 block">63.8% Win Rate</span>
                    </div>
                    <div className="p-3 bg-card rounded-xl border border-hairline shadow-sm space-y-0.5">
                      <span className="text-[10px] font-mono text-fg-muted uppercase block">Primetime Peak</span>
                      <div className="text-sm font-bold font-mono text-fg">$9.60 <span className="text-[10px] font-normal text-fg-muted">P90</span></div>
                      <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 block">41.5% Win Rate</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Policy Mathematical Synthesis */}
          {stepIndex >= 3 && (
            <div className="p-5 rounded-2xl border transition-all bg-card border-purple-500/40 text-fg shadow-sm animate-rise space-y-3">
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                  stepIndex > 3 
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' 
                    : 'bg-vibe-cyan border-vibe-cyan text-black animate-pulse shadow-md'
                }`}>
                  {stepIndex > 3 ? <Check size={16} /> : <Cpu size={16} />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                      3. Gemini Reasoning Engine — Mathematical Policy Synthesis
                    </span>
                    <span className="text-[11px] font-mono text-fg-muted">Optimization Logic</span>
                  </div>
                  <p className="text-fg-muted text-xs font-sans leading-relaxed">
                    Formulated dynamic hourly pacing velocity and daypart bid shading logic derived from BigQuery telemetry:
                  </p>
                </div>
              </div>

              {/* Gemini Derivations Grid */}
              <div className="pl-12 space-y-2 pt-1">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 font-mono text-xs">
                  <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block uppercase">1. Hourly Pacing Velocity</span>
                    <div className="text-fg font-bold">$2,500.00 / 24.0h = $104.16 / hr</div>
                    <p className="text-[11px] text-fg-muted font-sans">Calculated target hourly burn rate to prevent premature budget exhaustion before evening surges.</p>
                  </div>
                  <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block uppercase">2. Dynamic Pacing Coefficient</span>
                    <div className="text-fg font-bold">clamp(target_hourly / 104.16, 0.70, 1.25)</div>
                    <p className="text-[11px] text-fg-muted font-sans">Self-adjusting pacing multiplier: throttles bids by up to 30% if overspending, boosts by 25% if surplus exists.</p>
                  </div>
                  <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block uppercase">3. Daypart Bid Shading Logic</span>
                    <div className="text-fg font-bold">Late Night: $0.95 · Primetime: P90 + $0.05</div>
                    <p className="text-[11px] text-fg-muted font-sans">Shades bid to $0.95 during midnight cooldown (saving $1.55/bid vs baseline) and captures primetime at $9.60 floor.</p>
                  </div>
                  <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                    <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block uppercase">4. Safety Guardrail Clamping</span>
                    <div className="text-fg font-bold">min(computed_bid, max_bid_ceiling)</div>
                    <p className="text-[11px] text-fg-muted font-sans">Hard deterministic constraint enforcing the $10.00 CPM ceiling across all branches.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: deploy_bidding_policy */}
          {stepIndex >= 4 && (
            <div className="p-5 rounded-2xl border transition-all bg-card border-amber-500/40 text-fg shadow-sm animate-rise space-y-3">
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                  stepIndex >= 5 
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm' 
                    : 'bg-vibe-cyan border-vibe-cyan text-black animate-pulse shadow-md'
                }`}>
                  {stepIndex >= 5 ? <Check size={16} /> : <FileCode2 size={16} />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-700 dark:text-amber-400 text-sm flex items-center gap-1.5">
                      4. <code className="font-mono bg-amber-500/10 px-1.5 py-0.5 rounded text-xs">deploy_bidding_policy()</code> — Production Code Actuator
                    </span>
                    <span className="text-[11px] font-mono text-fg-muted">File Deployment</span>
                  </div>
                  <p className="text-fg-muted text-xs font-sans leading-relaxed">
                    Validated Python AST, verified <code className="font-mono text-fg bg-overlay px-1 rounded">compute_bid(context)</code> signature, and atomically deployed to <code className="text-fg font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline">policies/agent_bidding_policy.py</code>.
                  </p>
                </div>
              </div>

              {/* Step 4 Tool Call Verification Details */}
              <div className="pl-12 space-y-2 pt-1">
                <div className="p-3 bg-overlay rounded-xl border border-hairline font-mono text-[11px] space-y-2">
                  <div className="flex items-center justify-between text-[10px] text-fg-muted uppercase tracking-wider font-bold border-b border-hairline/60 pb-1">
                    <span>Actuator Tool Call Verification</span>
                    <span className="text-amber-600 dark:text-amber-400">AST Validated</span>
                  </div>
                  <pre className="text-fg-muted leading-relaxed overflow-x-auto text-[11px]">
{`deploy_bidding_policy(
    python_code="""def compute_bid(context: AuctionContext) -> float: ...""",
    strategy_summary="Diurnal adaptive pacing with P90 bid shading across dayparts"
)`}
                  </pre>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] border border-emerald-500/30">✓ Valid AST</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] border border-emerald-500/30">✓ compute_bid(context) Verified</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] border border-emerald-500/30">✓ PEP 8 Formatted</span>
                    <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] border border-emerald-500/30">✓ Atomic Write to policies/agent_bidding_policy.py</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Synthesized Code Section (ONLY Shown Below Steps When Completed) */}
      {completed && (
        <div className="space-y-4 animate-rise pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
              <Code2 size={15} className="text-amber-600 dark:text-amber-400" />
              <span>Synthesized Production Policy Script</span>
            </div>
            <span className="text-[11px] font-mono text-fg-muted">policies/agent_bidding_policy.py</span>
          </div>

          <div className="p-6 bg-card rounded-3xl border border-hairline shadow-2xl space-y-6">
            <div className="rounded-2xl overflow-hidden border border-hairline bg-card shadow-md">
              <PythonCodeHighlight
                code={AI_GENERATED_PYTHON_SCRIPT}
                filename="agent_bidding_policy.py"
                editable={false}
                className="max-h-[520px]"
              />
            </div>

            <div className="p-5 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-rise shadow-sm">
              <div className="flex items-center gap-3 text-xs font-mono text-purple-800 dark:text-purple-300">
                <CheckCircle2 size={20} className="text-purple-600 dark:text-purple-400 shrink-0" />
                <div>
                  <strong className="block text-fg font-sans text-sm">Initial Policy Candidate Synthesized (Generation 1)</strong>
                  <span className="text-fg-muted text-xs font-normal">
                    In enterprise ad-tech, generative policies are never sent unverified to live auctions. Next, we use <strong>ADK Eval</strong> and the <strong>Simulation Judge Agent</strong> to benchmark safety guardrails, critique pacing, and graduate this policy into a production Champion.
                  </span>
                </div>
              </div>
              <button
                onClick={handleDeployAndProceed}
                disabled={deploying}
                className="px-6 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                <span>{deploying ? 'Deploying...' : 'Proceed to Agent Evaluation'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
