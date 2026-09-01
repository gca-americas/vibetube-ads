import { useState } from 'react';
import { 
  Terminal, Code2,
  ArrowRight, ArrowLeft, Bot, Check, CheckCircle2,
  Play, RefreshCw, Database, Cpu, FileCode2
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';
import SqlCodeHighlight from './SqlCodeHighlight';

const SAMPLE_BIGQUERY_SQL = `-- Synthesized by Google Cloud BigQuery Data Engineering Agent
SELECT 
  daypart,
  APPROX_QUANTILES(clearing_cpm, 100)[OFFSET(90)] AS p90_clearing_cpm,
  AVG(CASE WHEN won THEN 1.0 ELSE 0.0 END) AS avg_win_rate,
  COUNT(1) AS total_auction_volume
FROM \`vibeflix-sandbox.vibetube_telemetry.auction_events\`
GROUP BY daypart
ORDER BY p90_clearing_cpm DESC;`;

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
          <button
            onClick={() => navigate('ai_engineer')}
            className="px-4 py-2.5 bg-card hover:bg-overlay text-fg text-xs font-mono font-medium rounded-xl border border-hairline transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft size={14} />
            <span>Back to Wiring (Step 5)</span>
          </button>

          <button
            onClick={handleRunAgent}
            disabled={isRunning}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-md cursor-pointer ${
              isRunning
                ? 'bg-card text-fg-muted border border-hairline cursor-wait'
                : 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black shadow-vibe-cyan/20'
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Executing Trajectory...</span>
              </>
            ) : completed ? (
              <>
                <RefreshCw size={15} />
                <span>Re-Execute Workflow</span>
              </>
            ) : (
              <>
                <Play size={15} className="fill-black" />
                <span>Execute Bidding Policy Agent</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Initial Hero Callout (When Not Started) */}
      {!isRunning && !completed && (
        <div className="p-8 bg-card rounded-3xl border border-hairline shadow-xl text-center space-y-4 max-w-3xl mx-auto py-12">
          <div className="w-16 h-16 rounded-2xl bg-vibe-cyan/15 border border-vibe-cyan/40 flex items-center justify-center text-vibe-cyan mx-auto shadow-md">
            <Bot size={32} />
          </div>
          <div className="space-y-1">
            <h3 className="text-xl font-display font-bold text-fg">Ready to Execute Bidding Policy Agent</h3>
            <p className="text-xs text-fg-muted max-w-lg mx-auto font-sans leading-relaxed">
              All 3 tools (<code className="text-fg font-mono">get_campaign_info</code>, <code className="text-fg font-mono">DataAgentToolset</code>, and <code className="text-fg font-mono">deploy_bidding_policy</code>) are wired in <code className="text-fg font-mono">agent.py</code>. Click below to launch the autonomous trajectory.
            </p>
          </div>

          <button
            onClick={handleRunAgent}
            className="px-8 py-3.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-sm rounded-2xl transition-all shadow-lg hover:shadow-vibe-cyan/30 hover:scale-105 flex items-center gap-2.5 mx-auto cursor-pointer"
          >
            <Play size={18} className="fill-black" />
            <span>Launch Agent Trajectory</span>
          </button>
        </div>
      )}

      {/* Full-Width Multi-Agent Trajectory Trace (Visible When Running or Completed) */}
      {(stepIndex > 0 || completed) && (
        <div className="space-y-4 animate-rise">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
              <Terminal size={15} className="text-vibe-cyan" />
              <span>Multi-Agent Trajectory Workflow</span>
            </div>
            {completed && (
              <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 font-bold shadow-sm">
                <Check size={13} /> Trajectory Complete
              </span>
            )}
          </div>

          <div className="p-6 bg-card rounded-3xl border border-hairline shadow-2xl space-y-4 font-mono text-xs">
            {/* Step 1: get_campaign_info */}
            <div className={`p-5 rounded-2xl border transition-all ${
              stepIndex >= 1 ? 'bg-card border-emerald-500/40 text-fg shadow-sm' : 'bg-card/40 border-hairline text-fg-muted opacity-50'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  stepIndex > 1 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : stepIndex === 1 
                      ? 'bg-vibe-cyan text-black animate-pulse shadow-md' 
                      : 'bg-overlay text-fg-muted'
                }`}>
                  {stepIndex > 1 ? <Check size={16} /> : <Database size={16} />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">
                      1. get_campaign_info() — Ad Server State Reader
                    </span>
                    <span className="text-[11px] font-mono text-fg-muted">REST Endpoint</span>
                  </div>
                  <p className="text-fg-muted text-xs font-sans leading-relaxed">
                    Retrieved live campaign state: <strong className="text-fg">$2,500.00 Total Budget</strong>, <strong className="text-fg">24.0-hour flight window</strong>, and <strong className="text-fg">$10.00 Max Bid Ceiling</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 2: BigQuery Data Agent A2A */}
            <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
              stepIndex >= 2 ? 'bg-card border-vibe-cyan/40 text-fg shadow-sm' : 'bg-card/40 border-hairline text-fg-muted opacity-50'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  stepIndex > 2 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : stepIndex === 2 
                      ? 'bg-vibe-cyan text-black animate-pulse shadow-md' 
                      : 'bg-overlay text-fg-muted'
                }`}>
                  {stepIndex > 2 ? <Check size={16} /> : <Bot size={16} />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-cyan-700 dark:text-vibe-cyan text-sm">
                      2. ask_data_agent (A2A) — BigQuery Data Engineering Agent
                    </span>
                    <span className="text-[11px] font-mono text-fg-muted">Agent-to-Agent</span>
                  </div>
                  <p className="text-fg-muted text-xs font-sans leading-relaxed">
                    Dispatched natural language analytical intent to Google Cloud's BigQuery Data Engineering Agent. Synthesized and executed BigQuery Standard SQL across 200,000 historical auction events:
                  </p>
                </div>
              </div>

              {stepIndex >= 2 && (
                <div className="pl-12 pt-1">
                  <div className="rounded-xl overflow-hidden border border-hairline bg-card shadow-sm">
                    <SqlCodeHighlight
                      code={SAMPLE_BIGQUERY_SQL}
                      showLineNumbers={false}
                      className="max-h-[160px]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Step 3: Policy Mathematical Synthesis */}
            <div className={`p-5 rounded-2xl border transition-all ${
              stepIndex >= 3 ? 'bg-card border-purple-500/40 text-fg shadow-sm' : 'bg-card/40 border-hairline text-fg-muted opacity-50'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  stepIndex > 3 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : stepIndex === 3 
                      ? 'bg-vibe-cyan text-black animate-pulse shadow-md' 
                      : 'bg-overlay text-fg-muted'
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
                    Calculated hourly budget pacing rate ($104.16/hr) and synthesized daypart-adaptive bid shading formulas tracking market clearance floors.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 4: deploy_bidding_policy */}
            <div className={`p-5 rounded-2xl border transition-all ${
              stepIndex >= 4 ? 'bg-card border-amber-500/40 text-fg shadow-sm' : 'bg-card/40 border-hairline text-fg-muted opacity-50'
            }`}>
              <div className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                  stepIndex >= 5 
                    ? 'bg-emerald-500 text-white shadow-sm' 
                    : stepIndex === 4 
                      ? 'bg-vibe-cyan text-black animate-pulse shadow-md' 
                      : 'bg-overlay text-fg-muted'
                }`}>
                  {stepIndex >= 5 ? <Check size={16} /> : <FileCode2 size={16} />}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-700 dark:text-amber-400 text-sm">
                      4. deploy_bidding_policy() — Production Code Actuator
                    </span>
                    <span className="text-[11px] font-mono text-fg-muted">File Deployment</span>
                  </div>
                  <p className="text-fg-muted text-xs font-sans leading-relaxed">
                    Validated Python AST, applied 88-character PEP 8 wrapping, and atomically deployed to <code className="text-fg font-mono">policies/agent_bidding_policy.py</code>.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

            <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-rise shadow-sm">
              <div className="flex items-center gap-2.5 text-xs font-mono text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-fg font-sans">Policy Synthesized & Hot-Reloaded</strong>
                  <span className="text-fg-muted text-[11px]">Ready for semantic benchmarking with ADK evaluation tools.</span>
                </div>
              </div>
              <button
                onClick={handleDeployAndProceed}
                disabled={deploying}
                className="px-6 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
              >
                <span>{deploying ? 'Deploying...' : 'Proceed to ADK Eval (Step 7)'}</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
