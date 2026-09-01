import { useState } from 'react';
import { 
  Scale, Bot, CheckCircle2,
  ArrowRight, Play, RefreshCw, Award, TrendingUp
} from 'lucide-react';

export default function JudgeAgent({ navigate }: { navigate: (v: string) => void }) {
  const [isRunning, setIsRunning] = useState(false);
  const [flywheelCompleted, setFlywheelCompleted] = useState(false);
  const [currentRound, setCurrentRound] = useState(0);

  const handleRunFlywheel = async () => {
    setIsRunning(true);
    setFlywheelCompleted(false);
    setCurrentRound(1);

    // Round 1 Generator
    await new Promise(r => setTimeout(r, 1000));
    setCurrentRound(2);

    // Round 1 Judge Evaluation
    await new Promise(r => setTimeout(r, 1400));
    setCurrentRound(3);

    // Champion Selection
    await new Promise(r => setTimeout(r, 1000));
    setCurrentRound(4);

    setIsRunning(false);
    setFlywheelCompleted(true);
  };

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-fg">
            The Simulation Judge Agent
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Connect the Generator Agent (<code className="text-fg font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline">agent.py</code>) to the Simulation Judge Agent (<code className="text-fg font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline">judge_agent.py</code>) in an autonomous ADK 2.0 cyclic optimization graph.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('simulator3')}
            className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to Simulation (Step 9)</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Cyclic Graph Architecture Canvas */}
      <div className="p-8 bg-card rounded-3xl border border-hairline shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-vibe-cyan" />
            <h3 className="text-sm font-bold text-fg uppercase font-mono tracking-wider flex items-center gap-2">
              <span>ADK 2.0 Cyclic Workflow Graph (</span>
              <code className="font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline text-fg font-normal">optimize_loop.py</code>
              <span>)</span>
            </h3>
          </div>
          <span className="text-xs font-mono text-fg-muted">
            Pattern: <strong>Actor-Critic Optimization Loop</strong>
          </span>
        </div>

        {/* Workflow Nodes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Node 1: Generator */}
          <div className={`p-4 rounded-2xl border-2 transition-all space-y-2 shadow-sm ${
            currentRound >= 1 ? 'bg-card border-vibe-cyan' : 'bg-card border-dashed border-hairline'
          }`}>
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-vibe-cyan" />
              <h4 className="text-xs font-bold font-mono text-fg">1. Generator Node</h4>
            </div>
            <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
              Prompts Bidding Policy Agent to formulate & synthesize candidate bidding policy.
            </p>
          </div>

          {/* Node 2: Simulation Judge */}
          <div className={`p-4 rounded-2xl border-2 transition-all space-y-2 shadow-sm ${
            currentRound >= 2 ? 'bg-card border-purple-500' : 'bg-card border-dashed border-hairline'
          }`}>
            <div className="flex items-center gap-2">
              <Scale size={18} className="text-purple-600 dark:text-purple-400" />
              <h4 className="text-xs font-bold font-mono text-fg">2. Judge Node</h4>
            </div>
            <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
              Simulates 600k auctions under live market physics and scores Yield (0 - 100).
            </p>
          </div>

          {/* Node 3: Router */}
          <div className={`p-4 rounded-2xl border-2 transition-all space-y-2 shadow-sm ${
            currentRound >= 3 ? 'bg-card border-amber-500' : 'bg-card border-dashed border-hairline'
          }`}>
            <div className="flex items-center gap-2">
              <TrendingUp size={18} className="text-amber-600 dark:text-amber-400" />
              <h4 className="text-xs font-bold font-mono text-fg">3. Router Node</h4>
            </div>
            <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
              Checks score threshold (&ge; 99.5). Branches to <code className="text-fg font-mono">SHIP</code> or cycles to <code className="text-fg font-mono">IMPROVE</code>.
            </p>
          </div>

          {/* Node 4: Champion Publisher */}
          <div className={`p-4 rounded-2xl border-2 transition-all space-y-2 shadow-sm ${
            currentRound >= 4 ? 'bg-card border-emerald-500 shadow-emerald-500/10' : 'bg-card border-dashed border-hairline'
          }`}>
            <div className="flex items-center gap-2">
              <Award size={18} className="text-emerald-600 dark:text-emerald-400" />
              <h4 className="text-xs font-bold font-mono text-fg">4. Champion Deploy</h4>
            </div>
            <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
              Deploys top-scoring policy directly to production runtime.
            </p>
          </div>
        </div>

        {/* Interactive Trigger */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleRunFlywheel}
            disabled={isRunning}
            className="px-6 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Executing Cyclic Optimization Loop...</span>
              </>
            ) : flywheelCompleted ? (
              <>
                <RefreshCw size={15} />
                <span>Re-Run Flywheel (<code className="font-mono font-normal">optimize_loop.py</code>)</span>
              </>
            ) : (
              <>
                <Play size={15} className="fill-black" />
                <span>Run Cyclic Flywheel (<code className="font-mono font-normal">optimize_loop.py</code>)</span>
              </>
            )}
          </button>

          {flywheelCompleted && (
            <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>Score 99.6/100 Reached in Round 1</span>
            </span>
          )}
        </div>
      </div>

      {/* Flywheel Terminal & Leaderboard Output */}
      {(isRunning || flywheelCompleted) && (
        <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-4 animate-rise">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <span className="text-xs font-mono font-bold text-fg uppercase tracking-wider">
              Optimization Flywheel Leaderboard
            </span>
            <span className="text-[11px] font-mono text-fg-muted">policies/agent_bidding_policy.py</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-hairline text-fg-muted">
                  <th className="py-2.5 px-3">Gen</th>
                  <th className="py-2.5 px-3">Yield Score</th>
                  <th className="py-2.5 px-3">Impressions Won</th>
                  <th className="py-2.5 px-3">Total Spend</th>
                  <th className="py-2.5 px-3">Effective CPM</th>
                  <th className="py-2.5 px-3 text-right">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                <tr className="text-fg bg-overlay/50">
                  <td className="py-3 px-3 font-bold">1</td>
                  <td className="py-3 px-3 font-bold text-emerald-700 dark:text-emerald-300">99.6 / 100</td>
                  <td className="py-3 px-3">533,785</td>
                  <td className="py-3 px-3">$2,500.00 (100.0%)</td>
                  <td className="py-3 px-3">$4.68</td>
                  <td className="py-3 px-3 text-right">
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
                      ⭐ Champion
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Next Action Callout */}
          {flywheelCompleted && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-rise mt-4">
              <div className="flex items-center gap-2 text-xs font-mono text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <span>Champion policy deployed and verified against 600,000 simulated auctions!</span>
              </div>
              <button
                onClick={() => navigate('simulator3')}
                className="px-6 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                <span>Simulate Champion Policy (Step 9)</span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
