import { useState, useEffect, useRef } from 'react';
import { 
  Bot, CheckCircle2,
  ArrowRight, ArrowLeft, Play, RefreshCw, Award, Code2,
  Scale, TrendingUp, Loader2, Terminal, Copy, Check
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';
import { GEMINI_MODEL_LABEL } from '../config/models';

interface RoundRecord {
  round: number;
  title: string;
  policySummary: string;
  score: number;
  impressions: string;
  spend: string;
  ecpm: string;
  diagnostics: string;
  feedbackToGenerator: string;
  status: 'refining' | 'champion';
  candidate_code?: string;
}

export default function OptimizationFlywheel({ navigate }: { navigate: (v: string) => void }) {
  const [isRunning, setIsRunning] = useState(false);
  const [loopCompleted, setLoopCompleted] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'generator_turn' | 'passing_to_judge' | 'judge_evaluating' | 'feedback_loop' | 'converged'>('idle');
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [completedRounds, setCompletedRounds] = useState<RoundRecord[]>([]);
  const [recordedRounds, setRecordedRounds] = useState<RoundRecord[]>([]);
  const [championScript, setChampionScript] = useState<string>('');
  const [isSyncingDisk, setIsSyncingDisk] = useState(false);
  const [championScore, setChampionScore] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState(false);

  const playbackTimersRef = useRef<any[]>([]);

  const fetchLiveHistory = async () => {
    setIsSyncingDisk(true);
    try {
      const res = await fetch('/optimization/history');
      if (res.ok) {
        const data = await res.json();
        
        if (data.recorded_rounds && Array.isArray(data.recorded_rounds)) {
          setRecordedRounds(data.recorded_rounds);
        }

        if (data.rounds && Array.isArray(data.rounds) && data.rounds.length > 0) {
          setCompletedRounds(data.rounds);
        }

        if (data.current_round !== undefined && data.current_round > 0) {
          setCurrentRound(data.current_round);
        }
        if (data.current_phase) {
          setPhase(data.current_phase);
        }
        if (data.completed) {
          setLoopCompleted(true);
          setPhase('converged');
          if (data.champion_score) {
            setChampionScore(data.champion_score);
          }
        }
        if (data.champion_script && data.champion_script.trim().length > 0) {
          setChampionScript(data.champion_script);
          if (data.completed) {
            setLoopCompleted(true);
          }
        } else if (data.policy_exists === false && !data.completed) {
          setChampionScript('');
          setLoopCompleted(false);
        }
        return data;
      }
    } catch (err) {
      console.warn('Failed to fetch /optimization/history:', err);
    } finally {
      setIsSyncingDisk(false);
    }
    return null;
  };

  useEffect(() => {
    fetchLiveHistory();
    return () => {
      playbackTimersRef.current.forEach(t => clearTimeout(t));
    };
  }, []);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('python agentic_data_engineer/optimize_loop.py');
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  const startPlayback = (rounds: RoundRecord[]) => {
    playbackTimersRef.current.forEach(t => clearTimeout(t));
    playbackTimersRef.current = [];

    setIsRunning(true);
    setLoopCompleted(false);
    setCompletedRounds([]);
    setCurrentRound(1);
    setPhase('generator_turn');

    const delayPerRound = 3000; // 3s per round = 12s total for 4 rounds

    rounds.forEach((round, idx) => {
      const baseDelay = idx * delayPerRound;

      // 1. Generator turn
      const t1 = setTimeout(() => {
        setCurrentRound(round.round);
        setPhase('generator_turn');
      }, baseDelay);

      // 2. Passing to judge & simulating in market physics
      const t2 = setTimeout(() => {
        setPhase('judge_evaluating');
      }, baseDelay + 1000);

      // 3. Simulation Judge feedback & append round card
      const t3 = setTimeout(() => {
        setPhase('feedback_loop');
        setCompletedRounds(prev => [...prev.filter(r => r.round !== round.round), round]);
      }, baseDelay + 2000);

      playbackTimersRef.current.push(t1, t2, t3);
    });

    // Final convergence after all rounds complete
    const totalTime = rounds.length * delayPerRound;
    const finalTimer = setTimeout(async () => {
      const winningRound = rounds[rounds.length - 1];
      const winningCode = winningRound.candidate_code || '';
      const finalScore = winningRound.score;

      setPhase('converged');
      setLoopCompleted(true);
      setIsRunning(false);
      setChampionScore(finalScore);
      setChampionScript(winningCode);

      // Atomically write the champion policy to disk so Step 11 & Step 12 run against it
      if (winningCode) {
        try {
          await fetch('/campaign/script?file=agent_bidding_policy.py', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: 'agent_bidding_policy.py', script: winningCode }),
          });
        } catch (err) {
          console.warn('Failed to deploy champion policy to disk:', err);
        }
      }
    }, totalTime);

    playbackTimersRef.current.push(finalTimer);
  };

  const handleRunFlywheel = async () => {
    if (isRunning) return;
    setErrorMessage(null);

    // If recorded rounds exist, start playback immediately
    if (recordedRounds.length > 0) {
      startPlayback(recordedRounds);
      return;
    }

    // Otherwise fetch latest history first
    const data = await fetchLiveHistory();
    const available = data?.recorded_rounds || data?.rounds || [];
    if (available.length > 0) {
      startPlayback(available);
    } else {
      setErrorMessage('No recorded optimization rounds found on disk. Please verify recorded_optimization_history.json.');
    }
  };

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-fg flex flex-wrap items-center gap-2">
            <span>Generator-Judge</span>
            <span className="text-vibe-cyan bg-vibe-cyan/10 border border-vibe-cyan/30 px-3 py-0.5 rounded-xl font-mono text-2xl font-bold">
              Optimization Loop
            </span>
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            The Generator Agent synthesizes candidate bidding policies, passes them to the Simulation Judge for market evaluation, and iteratively refines until reaching peak yield.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {loopCompleted ? (
            <button
              onClick={() => navigate('simulator3')}
              className="px-6 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg bg-vibe-cyan hover:bg-vibe-cyan/90 text-black hover:shadow-vibe-cyan/20 cursor-pointer animate-pulse"
            >
              <span>Proceed to Step 11: Agent Sim</span>
              <ArrowRight size={15} />
            </button>
          ) : (
            <button
              onClick={() => navigate('simulator3')}
              className="px-5 py-2.5 bg-overlay hover:bg-hairline text-fg text-xs font-mono font-medium rounded-xl border border-hairline transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Skip to Step 11: Agent Sim</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Background Command & Instructions Box */}
      <div className="p-4 bg-overlay/80 border border-hairline rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono text-xs shadow-sm">
        <div className="flex items-start sm:items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-vibe-cyan/15 text-cyan-700 dark:text-vibe-cyan border border-vibe-cyan/30 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
            <Terminal size={15} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-fg font-sans">Background Terminal Command:</span>
              <code className="text-vibe-cyan font-bold bg-vibe-cyan/10 px-2 py-0.5 rounded border border-vibe-cyan/25 select-all text-[11px]">
                python agentic_data_engineer/optimize_loop.py
              </code>
            </div>
            <p className="text-[11px] text-fg-muted font-sans mt-0.5">
              In your Cloud Shell terminal, you can run this command to execute the live multi-agent loop with {GEMINI_MODEL_LABEL}. Click <strong>Run Optimization Flywheel</strong> below to play through the verified recorded trace and advance immediately.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyCommand}
          className="px-3 py-1.5 rounded-lg bg-card hover:bg-hairline border border-hairline text-fg text-xs font-mono flex items-center gap-1.5 transition-all self-start sm:self-center shrink-0 cursor-pointer shadow-sm"
        >
          {copiedCommand ? (
            <>
              <Check size={13} className="text-emerald-400" />
              <span className="text-emerald-400 font-bold">Copied</span>
            </>
          ) : (
            <>
              <Copy size={13} className="text-fg-muted" />
              <span>Copy Command</span>
            </>
          )}
        </button>
      </div>

      {/* 1. HIGH-LEVEL CLOSED-LOOP ARCHITECTURE CANVAS */}
      <div className="p-8 bg-card rounded-3xl border border-hairline shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hairline pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-vibe-cyan/15 border border-vibe-cyan/30 flex items-center justify-center text-vibe-cyan">
              <RefreshCw size={16} className={isRunning ? 'animate-spin' : ''} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-fg uppercase font-mono tracking-wider flex items-center gap-2">
                <span>The Optimization Loop (Closed-Loop Workflow)</span>
                {isRunning && (
                  <span className="px-2 py-0.5 rounded-full bg-vibe-cyan/20 border border-vibe-cyan/40 text-[10px] font-mono font-bold text-cyan-700 dark:text-vibe-cyan animate-pulse">
                    Round {currentRound} Active
                  </span>
                )}
              </h3>
              <span className="text-[11px] font-mono text-fg-muted">
                Generator Agent ➔ Passes Candidate Policy ➔ Simulation Judge Evaluates ➔ Returns Feedback
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-fg-muted">
            <span className="px-2.5 py-1 rounded-lg bg-overlay border border-hairline flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${
                loopCompleted 
                  ? 'bg-emerald-500' 
                  : isRunning 
                    ? 'bg-vibe-cyan animate-ping' 
                    : 'bg-amber-400'
              }`} />
              <span>{loopCompleted ? (championScore ? `Target Converged (${championScore}/100)` : 'Target Converged (Score ≥ 99.5)') : isRunning ? `Round ${currentRound} in Progress...` : 'Target: ≥ 99.5 Yield Score'}</span>
            </span>
          </div>
        </div>

        {/* Zoomed-Out 2-Agent Closed Loop Diagram */}
        <div className="relative py-4 px-2 select-none">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center relative z-10">
            {/* Left Agent: Generator Agent */}
            <div className={`md:col-span-4 p-6 rounded-3xl border-2 transition-all flex flex-col justify-between space-y-4 bg-card ${
              phase === 'generator_turn'
                ? 'border-vibe-cyan shadow-xl shadow-vibe-cyan/20 ring-4 ring-vibe-cyan/20 scale-[1.02]'
                : 'border-hairline shadow-md'
            }`}>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-vibe-cyan/15 text-cyan-700 dark:text-vibe-cyan border border-vibe-cyan/30 flex items-center justify-center">
                  <Bot size={22} />
                </div>
                <span className="text-[11px] font-mono text-cyan-800 dark:text-vibe-cyan font-bold bg-vibe-cyan/10 px-2.5 py-0.5 rounded-full border border-vibe-cyan/20">
                  Generator Agent (Actor)
                </span>
              </div>

              <div>
                <h4 className="text-base font-bold font-display text-fg">Generator Agent</h4>
                <p className="text-xs font-mono text-fg-muted">agent.py (Campaign Manager)</p>
              </div>

              <div className="space-y-1.5 text-xs text-fg-muted font-sans border-t border-hairline pt-3">
                <p className="leading-relaxed">
                  Synthesizes dynamic <code className="font-mono text-fg bg-overlay px-1 py-0.5 rounded text-[11px]">compute_bid(context)</code> Python scripts incorporating past critique.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-fg-muted border-t border-hairline">
                <span>Model:</span>
                <span className="text-vibe-cyan font-bold">{GEMINI_MODEL_LABEL}</span>
              </div>
            </div>

            {/* Center Flow Channels: Forward Policy Transfer & Return Feedback */}
            <div className="md:col-span-4 flex flex-col items-center justify-center space-y-6 py-2 px-2">
              {/* Forward Channel: Generator -> Passes Policy -> Judge */}
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                  <span className="text-cyan-700 dark:text-vibe-cyan flex items-center gap-1">
                    <span>1. Passes Candidate Policy</span>
                  </span>
                  <span className="text-fg-muted">code string</span>
                </div>
                <div className={`p-3 rounded-2xl border-2 transition-all flex items-center justify-between gap-2 shadow-sm ${
                  phase === 'passing_to_judge' || phase === 'judge_evaluating'
                    ? 'bg-vibe-cyan/15 border-vibe-cyan text-fg shadow-md shadow-vibe-cyan/10'
                    : 'bg-overlay/60 border-hairline text-fg-muted'
                }`}>
                  <span className="text-xs font-mono font-bold truncate">bidding_policy.py</span>
                  <ArrowRight size={16} className={`shrink-0 ${phase === 'passing_to_judge' ? 'text-vibe-cyan animate-pulse' : ''}`} />
                </div>
              </div>

              {/* Return Channel: Judge -> Feedback / Recommendations -> Generator */}
              <div className="w-full space-y-1.5">
                <div className="flex items-center justify-between text-[10px] font-mono font-bold">
                  <span className="text-purple-400 flex items-center gap-1">
                    <span>2. Structured Critique Feedback</span>
                  </span>
                  <span className="text-fg-muted">score &amp; fixes</span>
                </div>
                <div className={`p-3 rounded-2xl border-2 transition-all flex items-center justify-between gap-2 shadow-sm ${
                  phase === 'feedback_loop'
                    ? 'bg-purple-500/15 border-purple-500 text-fg shadow-md shadow-purple-500/10'
                    : 'bg-overlay/60 border-hairline text-fg-muted'
                }`}>
                  <ArrowLeft size={16} className={`shrink-0 ${phase === 'feedback_loop' ? 'text-purple-400 animate-pulse' : ''}`} />
                  <span className="text-xs font-mono font-bold truncate">Diagnostics &amp; Pacing Advice</span>
                </div>
              </div>
            </div>

            {/* Right Agent: Simulation Judge */}
            <div className={`md:col-span-4 p-6 rounded-3xl border-2 transition-all flex flex-col justify-between space-y-4 bg-card ${
              phase === 'judge_evaluating' || phase === 'converged'
                ? 'border-purple-500 shadow-xl shadow-purple-500/20 ring-4 ring-purple-500/20 scale-[1.02]'
                : 'border-hairline shadow-md'
            }`}>
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/15 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                  <Scale size={22} />
                </div>
                <span className="text-[11px] font-mono text-purple-300 font-bold bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/20">
                  Simulation Judge (Critic)
                </span>
              </div>

              <div>
                <h4 className="text-base font-bold font-display text-fg">Simulation Judge</h4>
                <p className="text-xs font-mono text-fg-muted">judge_agent.py (Critic Evaluator)</p>
              </div>

              <div className="space-y-1.5 text-xs text-fg-muted font-sans border-t border-hairline pt-3">
                <p className="leading-relaxed">
                  Simulates candidate policy against 600k auctions in market physics. Generates yield scores and root-cause diagnostics.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-between text-[11px] font-mono text-fg-muted border-t border-hairline">
                <span>Contract:</span>
                <span className="text-purple-400 font-bold">PolicyEvaluation Schema</span>
              </div>
            </div>
          </div>

          {/* Convergence Output Bar: Displayed when score >= 99.5 */}
          <div className="mt-4 pt-4 border-t border-hairline flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                loopCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-overlay text-fg-muted'
              }`}>
                <Award size={18} />
              </div>
              <div className="text-xs font-sans">
                <span className="font-bold text-fg block font-mono">Convergence Rule: Score &ge; 99.5 / 100</span>
                <span className="text-fg-muted text-[11px]">
                  {loopCompleted 
                    ? 'Optimal Pareto yield achieved! Crowned winning algorithm to policies/agent_bidding_policy.py.'
                    : 'If score < 99.5, the Judge routes diagnostics back to the Generator to synthesize an improved policy.'}
                </span>
              </div>
            </div>

            <button
              onClick={handleRunFlywheel}
              disabled={isRunning}
              className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
            >
              {isRunning ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-black" />
                  <span>Replaying ADK Loop (Round {currentRound})...</span>
                </>
              ) : loopCompleted ? (
                <>
                  <RefreshCw size={14} />
                  <span>Replay Optimization Flywheel</span>
                </>
              ) : (
                <>
                  <Play size={14} className="fill-black" />
                  <span>Run Optimization Flywheel</span>
                </>
              )}
            </button>
          </div>

          {errorMessage && (
            <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 font-mono">
              {errorMessage}
            </div>
          )}
        </div>
      </div>

      {/* 2. THE STORY: REAL STAGE-BY-STAGE GENERATIONAL EVOLUTION */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-hairline pb-2">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-vibe-cyan" />
            <h3 className="text-sm font-bold text-fg uppercase font-mono tracking-wider">
              2. Generational Evolution (Real Telemetry per Round)
            </h3>
          </div>
          <span className="text-xs font-mono text-fg-muted">
            {completedRounds.length > 0 
              ? `${completedRounds.length} Rounds Executed` 
              : isRunning 
                ? 'Loop executing in background...' 
                : 'Click "Run Optimization Loop" above to start'}
          </span>
        </div>

        {completedRounds.length === 0 ? (
          <div className="p-8 bg-card/60 rounded-3xl border border-dashed border-hairline text-center space-y-2">
            {isRunning ? (
              <div className="flex flex-col items-center justify-center space-y-3 py-4">
                <Loader2 size={24} className="animate-spin text-vibe-cyan" />
                <p className="text-xs font-mono text-fg">
                  ADK 2.0 Generator Agent is synthesizing candidate policy and passing to Simulation Judge...
                </p>
                <span className="text-[11px] font-mono text-fg-muted">
                  Simulating 600,000 auctions across dayparts and market shocks.
                </span>
              </div>
            ) : (
              <p className="text-xs font-mono text-fg-muted">
                The optimization loop has not run yet. Click <strong className="text-fg">"Run Optimization Loop"</strong> to execute the ADK Generator and Judge closed loop in real time.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {completedRounds.map((r) => (
              <div 
                key={r.round} 
                className={`p-6 bg-card rounded-3xl border transition-all animate-rise space-y-4 shadow-lg ${
                  r.status === 'champion' ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-hairline'
                }`}
              >
                {/* Round Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hairline pb-3">
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-bold text-xs font-mono ${
                      r.status === 'champion' 
                        ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30' 
                        : 'bg-vibe-cyan/15 text-cyan-800 dark:text-vibe-cyan border border-vibe-cyan/30'
                    }`}>
                      {r.round}
                    </span>
                    <div>
                      <h4 className="text-sm font-bold text-fg font-display">{r.title}</h4>
                      <p className="text-xs font-mono text-fg-muted">{r.policySummary}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-mono font-bold px-3 py-1 rounded-xl border ${
                      r.score >= 95 
                        ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300' 
                        : 'bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400'
                    }`}>
                      Score: {r.score} / 100
                    </span>
                    {r.status === 'champion' ? (
                      <span className="px-2.5 py-1 rounded-xl bg-emerald-500 text-black text-xs font-mono font-bold flex items-center gap-1 shadow-sm">
                        <Award size={13} />
                        <span>Crowned Champion</span>
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-xl bg-overlay border border-hairline text-fg-muted text-xs font-mono font-medium">
                        Iterating
                      </span>
                    )}
                  </div>
                </div>

                {/* Simulation Telemetry Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                  <div className="bg-overlay/60 p-2.5 rounded-xl border border-hairline">
                    <span className="text-fg-muted text-[10px] block">Impressions Won</span>
                    <span className="text-fg font-bold">{r.impressions}</span>
                  </div>
                  <div className="bg-overlay/60 p-2.5 rounded-xl border border-hairline">
                    <span className="text-fg-muted text-[10px] block">Budget Spend</span>
                    <span className="text-fg font-bold">{r.spend}</span>
                  </div>
                  <div className="bg-overlay/60 p-2.5 rounded-xl border border-hairline">
                    <span className="text-fg-muted text-[10px] block">Effective CPM</span>
                    <span className="text-fg font-bold">{r.ecpm}</span>
                  </div>
                  <div className="bg-overlay/60 p-2.5 rounded-xl border border-hairline">
                    <span className="text-fg-muted text-[10px] block">Outcome</span>
                    <span className={r.status === 'champion' ? 'text-emerald-700 dark:text-emerald-300 font-bold' : 'text-amber-600 dark:text-amber-400 font-bold'}>
                      {r.status === 'champion' ? 'Converged (Ship)' : 'Improve (Loop Back)'}
                    </span>
                  </div>
                </div>

                {/* Side-by-Side: Judge Diagnosis vs Feedback Sent Back to Generator */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-sans">
                  <div className="p-3.5 rounded-2xl bg-overlay/60 border border-hairline space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-purple-400 uppercase">
                      <Scale size={13} />
                      <span>Judge's Market Diagnosis:</span>
                    </div>
                    <p className="text-fg-muted text-[11px] leading-relaxed font-sans">{r.diagnostics}</p>
                  </div>

                  <div className={`p-3.5 rounded-2xl border space-y-1 ${
                    r.status === 'champion'
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-vibe-cyan/10 border-vibe-cyan/30'
                  }`}>
                    <div className="flex items-center gap-1.5 text-xs font-mono font-bold uppercase text-fg">
                      {r.status === 'champion' ? (
                        <CheckCircle2 size={13} className="text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <ArrowLeft size={13} className="text-vibe-cyan" />
                      )}
                      <span>{r.status === 'champion' ? 'Final Verdict:' : 'Feedback Returned to Generator Agent:'}</span>
                    </div>
                    <p className="text-fg text-[11px] leading-relaxed font-mono">{r.feedbackToGenerator}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. CHAMPION BIDDING POLICY VIEWER */}
      {loopCompleted && (
        <div className="space-y-4 animate-rise pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
              <Code2 size={15} className="text-emerald-600 dark:text-emerald-400" />
              <span>Crowned Champion Bidding Policy {completedRounds.length > 0 ? `(Round ${completedRounds[completedRounds.length - 1].round})` : ''}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                Score: {championScore !== null ? championScore.toFixed(1) : (completedRounds.length > 0 ? completedRounds[completedRounds.length - 1].score.toFixed(1) : '—')}/100
              </span>
              <button
                type="button"
                onClick={fetchLiveHistory}
                title="Reload from disk (policies/agent_bidding_policy.py)"
                className="p-1.5 rounded-lg bg-overlay hover:bg-card border border-hairline text-fg-muted hover:text-fg transition-all text-xs flex items-center gap-1 font-mono cursor-pointer"
              >
                <RefreshCw size={12} className={isSyncingDisk ? 'animate-spin text-emerald-400' : ''} />
                <span className="text-[10px]">Sync Disk</span>
              </button>
            </div>
          </div>

          <div className="p-6 bg-card rounded-3xl border border-hairline shadow-2xl space-y-6">
            <div className="rounded-2xl overflow-hidden border border-hairline bg-card shadow-md">
              <PythonCodeHighlight
                code={championScript}
                filename="agent_bidding_policy.py"
                editable={false}
                className="max-h-[480px]"
              />
            </div>

            <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-rise shadow-sm">
              <div className="flex items-center gap-2.5 text-xs font-mono text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-fg font-sans">Champion Policy Deployed to Simulation Runtime</strong>
                  <span className="text-fg-muted text-[11px]">Ready to benchmark the winning policy in the full production ad serving simulator.</span>
                </div>
              </div>
              <button
                onClick={() => navigate('simulator3')}
                className="px-6 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 shrink-0"
              >
                <span>Proceed to Step 11: Simulate Champion</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
