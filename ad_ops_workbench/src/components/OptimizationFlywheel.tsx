import { useState, useEffect, useRef } from 'react';
import { 
  CheckCircle2,
  ArrowRight, ArrowDown, Play, RefreshCw, Award, Code2,
  Loader2, Terminal, Copy, Check, Lock,
  Sparkles, Workflow, Lightbulb
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';
import Simulator from './Simulator';

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

const INITIAL_WORKFLOW_CODE = `"""ADK 2.0 Native Workflow: Policy Optimization Loop."""

from google.adk import Workflow

from agent import root_agent
from judge_agent import judge_agent
from lib.nodes import generator, simulation_judge, router, proposer, done

workflow = Workflow(
    name="yield_optimization_flywheel",
    edges=[],
)`;

const FULLY_WIRED_WORKFLOW_CODE = `"""ADK 2.0 Native Workflow: Policy Optimization Loop."""

from google.adk import Workflow

from agent import root_agent
from judge_agent import judge_agent
from lib.nodes import generator, simulation_judge, router, proposer, done

workflow = Workflow(
    name="yield_optimization_flywheel",
    edges=[
        ("START", generator, simulation_judge, router),
        (router, {"improve": proposer, "ship": done}),
        (proposer, generator),
    ],
)`;

type StepId = 'initial_sequence' | 'conditional_branching' | 'cyclic_return';

interface StepTabItem {
  id: StepId;
  stepNum: number;
  label: string;
}

const STEP_TABS: StepTabItem[] = [
  {
    id: 'initial_sequence',
    stepNum: 1,
    label: '1. Initial Sequence',
  },
  {
    id: 'conditional_branching',
    stepNum: 2,
    label: '2. Conditional Branching',
  },
  {
    id: 'cyclic_return',
    stepNum: 3,
    label: '3. Cyclic Return Edge',
  },
];

const STEP_HINTS: Record<StepId, { text: string; code: string }> = {
  initial_sequence: {
    text: 'In workflow.py above, add the linear pipeline sequence to the edges list:',
    code: '("START", generator, simulation_judge, router),',
  },
  conditional_branching: {
    text: 'In workflow.py above, add dynamic conditional branching from the router to the edges list:',
    code: '(router, {"improve": proposer, "ship": done}),',
  },
  cyclic_return: {
    text: 'In workflow.py above, close the feedback loop from proposer back to generator:',
    code: '(proposer, generator),',
  },
};

interface CodeExplanation {
  title: string;
  description: string;
}

interface StepDetails {
  title: string;
  filename: string;
  codeSnippet: string;
  edgeLabel: string;
  explanations: CodeExplanation[];
}

const STEP_DETAILS: Record<StepId, StepDetails> = {
  initial_sequence: {
    title: 'Initial Sequence (Linear Forward Chain)',
    filename: 'ADK Concept 1: Linear Pipeline Sequence',
    edgeLabel: '("START", generator, simulation_judge, router)',
    codeSnippet: `# Pipeline Node Definitions:
def generator(generator_prompt: str = INITIAL_PROMPT, round: int = 1):
    """Prompts the Generator Agent to synthesize a bidding policy."""
    ask_agent(root_agent, generator_prompt)
    candidate_code = POLICY_PATH.read_text(encoding="utf-8")
    yield Event(state={"candidate_code": candidate_code, "round": round})


def simulation_judge(candidate_code: str, round: int):
    """Stress-tests policy in 600,000 auctions and obtains critic feedback."""
    policy_func = load_policy_from_code(candidate_code)
    sim = run_simulation(policy_func, seed=42)

    critique_prompt = (
        f"Review the simulation results for this candidate bidding policy:\\n"
        f"{sim.summary_text}\\n\\n"
        f"Candidate Code:\\n{candidate_code}\\n\\n"
        f"Provide root-cause diagnostics and concrete code recommendations."
    )
    judge_critique = ask_agent(judge_agent, critique_prompt)

    yield Event(
        state={
            "last_score": sim.yield_score,
            "diagnostics": sim.summary_text,
            "recommendations": judge_critique,
            "candidate_code": candidate_code,
            "round": round,
        }
    )


# 1. Linear Pipeline Sequence
# In ADK, passing a tuple ("START", node1, node2, ...) chains execution sequentially:
edges = [
    ("START", generator, simulation_judge, router),
]`,
    explanations: [
      {
        title: 'Linear Execution Pipeline',
        description: 'Chains "START" directly to generator, simulation_judge, and router in an ordered tuple, executing each node in strict sequence.',
      },
      {
        title: 'State Passing via Events',
        description: 'Each node yields Event(state={...}) dictionaries containing candidate_code and last_score, automatically passed to downstream nodes.',
      },
      {
        title: 'Actor-to-Judge Evaluation',
        description: 'Passes synthesized bidding policy code directly into the Simulation Judge for 24-hour market flight stress-testing.',
      },
    ],
  },
  conditional_branching: {
    title: 'Conditional Branching (Dynamic Route Dispatch)',
    filename: 'ADK Concept 2: Dynamic Conditional Branching',
    edgeLabel: '(router, {"improve": proposer, "ship": done})',
    codeSnippet: `# Dynamic Routing Logic inside router node:
def router(last_score: float, round: int):
    if last_score >= 99.5:
        yield Event(route="ship")      # Target yield reached -> ship to production
    elif round >= 2:
        yield Event(route="ship")      # Round budget reached -> ship champion
    else:
        yield Event(route="improve")   # Below target -> route to proposer


# 2. Conditional Routing Dictionary
# Map router node outputs to destination nodes using a branch mapping dictionary:
edges = [
    ("START", generator, simulation_judge, router),
    (router, {"improve": proposer, "ship": done}),
]`,
    explanations: [
      {
        title: 'Dynamic Route Dispatch',
        description: 'The router node yields Event(route="...") corresponding to dictionary keys, dynamically determining the next execution path.',
      },
      {
        title: 'Convergence Gate',
        description: 'When yield score reaches ≥ 99.5, the router automatically routes to the "ship" branch, terminating the loop and deploying the champion.',
      },
      {
        title: 'Safety Circuit Breaker',
        description: 'Guards against infinite loops by capping iterations at round 2 and routing to "ship" even if the target score has not fully converged.',
      },
    ],
  },
  cyclic_return: {
    title: 'Cyclic Return Edge (Autonomous Feedback Loop)',
    filename: 'ADK Concept 3: Cyclic Feedback Loop',
    edgeLabel: '(proposer, generator)',
    codeSnippet: `# In the proposer node, Judge feedback is injected into the next round prompt:
def proposer(recommendations: str, round: int):
    next_prompt = (
        f"Synthesize an improved bidding policy for the campaign.\\n\\n"
        f"Previous Simulation Judge Critique & Recommendations:\\n{recommendations}\\n\\n"
        f"Goal: Maximize total impressions won by pacing budget across the campaign flight."
    )
    yield Event(state={"generator_prompt": next_prompt, "round": round + 1})


# 3. Cyclic Return Loop
# Connect the proposer node back to the generator node, creating an autonomous cycle:
edges = [
    ("START", generator, simulation_judge, router),
    (router, {"improve": proposer, "ship": done}),
    (proposer, generator),  # <-- Cyclic return edge back to Generator
]`,
    explanations: [
      {
        title: 'Closing the Loop',
        description: 'Directs execution from the proposer node back into the generator, forming an autonomous Actor-Critic iterative refinement cycle.',
      },
      {
        title: 'Critique Mutation',
        description: 'The proposer node incorporates the Judge\'s root-cause diagnostics and recommendations into the next round\'s generator prompt.',
      },
      {
        title: 'Autonomous Convergence',
        description: 'The cycle repeats without manual intervention until the router confirms the synthesized policy meets the production quality threshold.',
      },
    ],
  },
};

function stripComments(code: string): string {
  return code
    .split('\n')
    .map(line => {
      const idx = line.indexOf('#');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');
}

function checkInitialSequenceWired(code: string): boolean {
  const uncommented = stripComments(code);
  const edgesMatch = uncommented.match(/edges\s*=\s*\[([\s\S]*?)\]/);
  const targetText = edgesMatch ? edgesMatch[1] : uncommented;
  return /\(\s*["']START["']\s*,\s*generator\s*,\s*simulation_judge\s*,\s*router\s*,?\s*\)/.test(targetText);
}

function checkConditionalBranchingWired(code: string): boolean {
  const uncommented = stripComments(code);
  const edgesMatch = uncommented.match(/edges\s*=\s*\[([\s\S]*?)\]/);
  const targetText = edgesMatch ? edgesMatch[1] : uncommented;

  const dictMatch = targetText.match(/router\s*,\s*\{([\s\S]*?)\}/);
  if (!dictMatch) return false;
  const dictContent = dictMatch[1];

  const hasImprove = /["']improve["']\s*:\s*proposer/.test(dictContent);
  const hasShip = /["']ship["']\s*:\s*done/.test(dictContent);
  return hasImprove && hasShip;
}

function checkCyclicReturnWired(code: string): boolean {
  const uncommented = stripComments(code);
  const edgesMatch = uncommented.match(/edges\s*=\s*\[([\s\S]*?)\]/);
  const targetText = edgesMatch ? edgesMatch[1] : uncommented;
  return /\(\s*proposer\s*,\s*generator\s*,?\s*\)/.test(targetText);
}

export default function OptimizationFlywheel({ navigate, activeLab }: { navigate: (v: string) => void; activeLab?: string }) {
  const [workflowCode, setWorkflowCode] = useState<string>(INITIAL_WORKFLOW_CODE);
  const [activeStepTab, setActiveStepTab] = useState<StepId>('initial_sequence');
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [copiedHint, setCopiedHint] = useState<string | null>(null);

  // Execution states
  const [isRunning, setIsRunning] = useState(false);
  const [loopCompleted, setLoopCompleted] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'generator_turn' | 'passing_to_judge' | 'judge_evaluating' | 'feedback_loop' | 'converged'>('idle');
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [completedRounds, setCompletedRounds] = useState<RoundRecord[]>([]);
  const [championScript, setChampionScript] = useState<string>('');
  const [isSyncingDisk, setIsSyncingDisk] = useState(false);
  const [championScore, setChampionScore] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedCommand, setCopiedCommand] = useState(false);

  const pollTimerRef = useRef<any>(null);
  const executionSectionRef = useRef<HTMLDivElement>(null);

  // Dynamic Theme Detection matching Steps 4 & 6
  const [isLight, setIsLight] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('light');
    }
    return false;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const checkTheme = () => setIsLight(document.documentElement.classList.contains('light'));
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const codeTagClass = isLight
    ? 'bg-slate-200/80 text-slate-900 border border-slate-300/60'
    : 'bg-overlay text-fg border border-hairline';

  const isInitialSequenceWired = checkInitialSequenceWired(workflowCode);
  const isConditionalBranchingWired = checkConditionalBranchingWired(workflowCode);
  const isCyclicReturnWired = checkCyclicReturnWired(workflowCode);

  const isWorkflowWired = isInitialSequenceWired && isConditionalBranchingWired && isCyclicReturnWired;
  const wiredCount = (isInitialSequenceWired ? 1 : 0) + (isConditionalBranchingWired ? 1 : 0) + (isCyclicReturnWired ? 1 : 0);

  const isTabUnlocked = (tabId: StepId): boolean => {
    if (tabId === 'initial_sequence') return true;
    if (tabId === 'conditional_branching') return isInitialSequenceWired;
    if (tabId === 'cyclic_return') return isInitialSequenceWired && isConditionalBranchingWired;
    return false;
  };

  const toggleHint = (stepId: string) => {
    setRevealedHints(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const handleCopyHint = (stepId: StepId) => {
    const codeToCopy = STEP_HINTS[stepId].code;
    navigator.clipboard.writeText(codeToCopy);
    setCopiedHint(stepId);
    setTimeout(() => setCopiedHint(null), 2000);
  };

  const handleInsertEdge = (stepId: StepId) => {
    setWorkflowCode(prev => {
      if (stepId === 'initial_sequence' && checkInitialSequenceWired(prev)) return prev;
      if (stepId === 'conditional_branching' && checkConditionalBranchingWired(prev)) return prev;
      if (stepId === 'cyclic_return' && checkCyclicReturnWired(prev)) return prev;

      const snippet = STEP_HINTS[stepId].code;
      const edgesMatch = prev.match(/edges\s*=\s*\[([\s\S]*?)\]/);
      if (!edgesMatch) return prev;

      const inner = edgesMatch[1];
      const trimmed = inner.trim();
      const newInner = trimmed.length > 0
        ? `${inner.replace(/\s+$/, '')}\n        ${snippet}\n    `
        : `\n        ${snippet}\n    `;

      return prev.replace(/edges\s*=\s*\[([\s\S]*?)\]/, `edges=[${newInner}]`);
    });
  };

  const fetchLiveHistory = async () => {
    setIsSyncingDisk(true);
    try {
      const res = await fetch('/optimization/history');
      if (res.ok) {
        const data = await res.json();

        if (data.rounds && Array.isArray(data.rounds) && data.rounds.length > 0) {
          setCompletedRounds(data.rounds);
          // If rounds already exist, auto-wire edges in editor for convenience
          setWorkflowCode(FULLY_WIRED_WORKFLOW_CODE);
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
          const roundsToUse = (data.rounds && Array.isArray(data.rounds) && data.rounds.length > 0)
            ? data.rounds
            : [];
          if (roundsToUse.length > 0) {
            const winningRound = roundsToUse[roundsToUse.length - 1];
            const impNum = parseInt(String(winningRound.impressions).replace(/,/g, ''), 10) || 507989;
            const spendNum = parseFloat(String(winningRound.spend).replace(/[^0-9.]/g, '')) || 2500.0;
            const ecpmNum = parseFloat(String(winningRound.ecpm).replace(/[^0-9.]/g, '')) || 4.92;
            const remainingNum = Math.max(0, 2500 - spendNum);
            try {
              localStorage.setItem('vibetube_flight_attempt_3', JSON.stringify({
                impressions: impNum,
                winRate: Math.round((impNum / 600000) * 1000) / 10,
                spend: spendNum,
                remaining: remainingNum,
                ecpm: ecpmNum,
                yieldScore: winningRound.score,
              }));
            } catch (e) {}
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
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [activeLab]);

  const handleCopyCommand = () => {
    navigator.clipboard.writeText('python agentic_data_engineer/optimize_loop.py');
    setCopiedCommand(true);
    setTimeout(() => setCopiedCommand(false), 2000);
  };

  const handleRunFlywheel = async () => {
    if (isRunning) return;
    setErrorMessage(null);

    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }

    setIsRunning(true);
    setLoopCompleted(false);
    setCompletedRounds([]);
    setCurrentRound(1);
    setPhase('generator_turn');

    try {
      const res = await fetch('/optimization/run-loop', { method: 'POST' });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        const detail = errText.trim() ? errText.trim() : 'Ad Server backend on port 8080 is unreachable. Run ./scripts/start.sh to restart services.';
        throw new Error(`Failed to launch optimization loop (${res.status}): ${detail}`);
      }

      // Active live polling mode every 1.5s
      const pollInterval = setInterval(async () => {
        try {
          const data = await fetchLiveHistory();
          if (!data) return;

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
            clearInterval(pollInterval);
            pollTimerRef.current = null;
            setIsRunning(false);
            setLoopCompleted(true);
            setPhase('converged');

            const roundsList = (data.rounds && Array.isArray(data.rounds) && data.rounds.length > 0)
              ? data.rounds
              : [];
            if (roundsList.length > 0) {
              const winningRound = roundsList[roundsList.length - 1];
              const winningCode = winningRound.candidate_code || data.champion_script || '';
              const finalScore = winningRound.score !== undefined ? winningRound.score : data.champion_score;

              if (finalScore !== undefined && finalScore !== null) {
                setChampionScore(finalScore);
              }
              if (winningCode) {
                setChampionScript(winningCode);
              }

              const impNum = parseInt(String(winningRound.impressions).replace(/,/g, ''), 10) || 507989;
              const spendNum = parseFloat(String(winningRound.spend).replace(/[^0-9.]/g, '')) || 2500.0;
              const ecpmNum = parseFloat(String(winningRound.ecpm).replace(/[^0-9.]/g, '')) || 4.92;
              const remainingNum = Math.max(0, 2500 - spendNum);
              try {
                localStorage.setItem('vibetube_flight_attempt_3', JSON.stringify({
                  impressions: impNum,
                  winRate: Math.round((impNum / 600000) * 1000) / 10,
                  spend: spendNum,
                  remaining: remainingNum,
                  ecpm: ecpmNum,
                  yieldScore: finalScore,
                }));
              } catch (e) {}

              if (winningCode) {
                try {
                  await fetch('/campaign/script?file=agent_bidding_policy.py', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: 'agent_bidding_policy.py', script: winningCode }),
                  });
                } catch (err) {
                  console.warn('Failed to sync champion policy to disk:', err);
                }
              }
            }
          }
        } catch (pollErr) {
          console.warn('Error polling /optimization/history:', pollErr);
        }
      }, 1500);

      pollTimerRef.current = pollInterval;
    } catch (err: any) {
      console.error('Live execution of /optimization/run-loop failed:', err);
      setIsRunning(false);
      setErrorMessage(err.message || 'Failed to launch optimization loop.');
    }
  };

  const nextTabId: StepId | null =
    activeStepTab === 'initial_sequence'
      ? 'conditional_branching'
      : activeStepTab === 'conditional_branching'
      ? 'cyclic_return'
      : null;
  const hasNextTab = nextTabId !== null;

  const isCurrentStepWired =
    activeStepTab === 'initial_sequence'
      ? isInitialSequenceWired
      : activeStepTab === 'conditional_branching'
      ? isConditionalBranchingWired
      : isCyclicReturnWired;

  const currentStepDetails = STEP_DETAILS[activeStepTab];

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* 1. ADK 2.0 Cyclic Workflow Diagram */}
      <div className="rounded-3xl overflow-hidden border border-hairline bg-[#FDFBF7] dark:bg-slate-950/40 p-6 md:p-8 shadow-xl flex flex-col items-center justify-center">
        <img
          src="/adk_workflow_diagram.png"
          alt="ADK 2.0 Cyclic Optimization Workflow Architecture"
          className="w-full max-w-4xl max-h-[460px] object-contain mx-auto rounded-xl drop-shadow-md"
        />
        <p className="text-sm text-slate-600 dark:text-fg-muted font-sans mt-3 text-center max-w-2xl leading-relaxed">
          <strong>ADK 2.0 Cyclic Optimization Workflow:</strong> The Generator Agent and Simulation Judge are wired into an autonomous cyclic execution graph with conditional branching, refining candidate bidding policies until the yield score exceeds the champion threshold.
        </p>
      </div>

      {/* 2. Interactive workflow.py Code Assembly (Editable, Single Instance Above Stepper) */}
      <div id="workflow-code-editor" className="rounded-3xl overflow-hidden border border-hairline bg-card shadow-xl">
        <PythonCodeHighlight
          code={workflowCode}
          filename="agentic_data_engineer/workflow.py"
          editable={true}
          showCopy={false}
          onChange={setWorkflowCode}
          onReset={() => setWorkflowCode(INITIAL_WORKFLOW_CODE)}
          isModified={workflowCode !== INITIAL_WORKFLOW_CODE}
          className="max-h-[640px]"
        />
      </div>

      {/* 3. Unified 3-Step Assembly Stepper (Workflow Edges) */}
      <div className="rounded-3xl border border-hairline bg-card shadow-xl overflow-hidden p-6 md:p-8 space-y-6">
        {/* Stepper Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-hairline pb-4 gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Workflow size={18} />
            </div>
            <div>
              <h3 className="text-base font-bold text-fg">
                ADK 2.0 Workflow Edge Assembly
              </h3>
              <span className="text-sm text-fg-muted font-sans">
                Wire linear sequences, dynamic branching, and cyclic feedback loops into the edges array
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1 rounded-xl bg-overlay border border-hairline text-fg-muted">
              Status: <strong className={isWorkflowWired ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>{isWorkflowWired ? '✓ Complete' : `${wiredCount}/3 Edges Wired`}</strong>
            </span>
          </div>
        </div>

        {/* Stepper Tabs Bar with Sequential Step Locking */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {STEP_TABS.map((tab) => {
            const isSelected = activeStepTab === tab.id;
            const isDone = tab.id === 'initial_sequence'
              ? isInitialSequenceWired
              : tab.id === 'conditional_branching'
              ? isConditionalBranchingWired
              : isCyclicReturnWired;
            const unlocked = isTabUnlocked(tab.id);

            return (
              <button
                key={tab.id}
                type="button"
                disabled={!unlocked}
                onClick={() => unlocked && setActiveStepTab(tab.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all relative flex items-center justify-between gap-2 ${
                  !unlocked
                    ? 'bg-overlay/20 border-hairline/60 opacity-40 cursor-not-allowed'
                    : isSelected
                    ? 'bg-card border-purple-500 shadow-md ring-2 ring-purple-500/20 cursor-pointer'
                    : isDone
                    ? 'bg-card/70 border-emerald-500/30 hover:border-emerald-500/60 cursor-pointer'
                    : 'bg-overlay/40 border-hairline hover:bg-overlay hover:border-slate-400/40 cursor-pointer'
                }`}
                title={!unlocked ? 'Complete preceding step to unlock' : tab.label}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    !unlocked
                      ? 'bg-overlay text-fg-muted/60'
                      : isDone
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : isSelected
                      ? 'bg-purple-500 text-white'
                      : 'bg-overlay text-fg-muted'
                  }`}>
                    {!unlocked ? (
                      <Lock size={12} />
                    ) : isDone ? (
                      <Check size={13} />
                    ) : (
                      <Workflow size={13} />
                    )}
                  </div>
                  <span className={`text-xs sm:text-sm font-bold font-mono truncate ${
                    !unlocked
                      ? 'text-fg-muted/60'
                      : isSelected
                      ? 'text-fg'
                      : isDone
                      ? 'text-fg'
                      : 'text-fg-muted'
                  }`}>
                    {tab.label}
                  </span>
                </div>
                {isDone ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    ✓ Done
                  </span>
                ) : !unlocked ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 bg-overlay text-fg-muted/60 border-hairline">
                    Locked
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Tab Content for activeStepTab */}
        <div className="space-y-4 animate-rise">
          <PythonCodeHighlight
            code={currentStepDetails.codeSnippet}
            filename={currentStepDetails.filename}
            editable={false}
            showCopy={false}
            className="max-h-[500px]"
          />

          {/* Help cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
            {currentStepDetails.explanations.map((item, idx) => (
              <div key={idx} className="p-4 bg-card rounded-2xl border border-hairline shadow-sm space-y-1.5">
                <h5 className="text-sm font-semibold text-fg flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-vibe-cyan shrink-0" />
                  {item.title}
                </h5>
                <p className="text-sm text-fg-muted leading-relaxed font-sans">{item.description}</p>
              </div>
            ))}
          </div>

          {/* Action Instruction & Next Navigation Bar */}
          <div className="pt-4 border-t border-hairline flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                isCurrentStepWired
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : isLight
                  ? 'bg-slate-100 border-slate-200 text-slate-500'
                  : 'bg-overlay border-hairline text-fg-muted'
              }`}>
                {isCurrentStepWired ? <Check size={16} /> : <Workflow size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg font-sans">
                  {isCurrentStepWired ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-mono">
                      Edge <code className="font-bold">{currentStepDetails.edgeLabel}</code> registered in <code className="font-bold">edges=[...]</code> above.
                    </span>
                  ) : (
                    <span>
                      Register <code className={`font-mono text-xs px-1.5 py-0.5 rounded ${codeTagClass}`}>{currentStepDetails.edgeLabel}</code> in <code className="font-mono text-fg font-bold">edges=[...]</code> above.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {hasNextTab ? (
              <button
                type="button"
                disabled={!isCurrentStepWired}
                onClick={() => isCurrentStepWired && setActiveStepTab(nextTabId)}
                className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 ${
                  isCurrentStepWired
                    ? 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black shadow-md cursor-pointer hover:shadow-vibe-cyan/20'
                    : isLight
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 opacity-60 cursor-not-allowed'
                    : 'bg-overlay text-fg-muted border border-hairline opacity-40 cursor-not-allowed'
                }`}
                title={isCurrentStepWired ? 'Advance to next edge' : 'Wire this edge in the edges array above to unlock'}
              >
                <span>|&gt; Next</span>
              </button>
            ) : isWorkflowWired ? (
              <button
                type="button"
                onClick={() => executionSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                className="px-4 py-2 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black rounded-xl text-xs font-semibold font-mono flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
              >
                <span>Run Flywheel ↓</span>
              </button>
            ) : null}
          </div>

          {/* Reveal Hint Component */}
          {!isCurrentStepWired && (
            <div className={`rounded-2xl border p-4 space-y-3 transition-colors ${
              isLight
                ? 'bg-amber-50/70 border-amber-200/90 text-slate-900 shadow-xs'
                : 'bg-overlay/30 border-hairline text-fg'
            }`}>
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => toggleHint(activeStepTab)}
                  className="text-sm font-mono font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center gap-2 cursor-pointer transition-colors"
                >
                  <Lightbulb size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>{revealedHints[activeStepTab] ? 'Hide Hint' : 'Reveal Hint'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleInsertEdge(activeStepTab)}
                  className="text-xs font-mono font-semibold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                >
                  <span>Insert into workflow.py</span>
                  <ArrowRight size={12} />
                </button>
              </div>

              {revealedHints[activeStepTab] && (
                <div className={`pt-3 border-t space-y-2.5 animate-rise ${isLight ? 'border-amber-200/80' : 'border-hairline'}`}>
                  <p className={`text-sm font-sans leading-relaxed ${isLight ? 'text-slate-800 font-medium' : 'text-fg'}`}>
                    {STEP_HINTS[activeStepTab].text}
                  </p>
                  <div className={`p-2.5 sm:p-3 rounded-xl border font-mono text-sm flex items-center justify-between gap-3 ${
                    isLight
                      ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
                      : 'bg-slate-950 border-slate-800 text-amber-300 shadow-inner'
                  }`}>
                    <code className="overflow-x-auto select-all py-0.5">{STEP_HINTS[activeStepTab].code}</code>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleInsertEdge(activeStepTab)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                          isLight
                            ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300'
                            : 'bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border-amber-500/40'
                        }`}
                        title="Directly insert this edge into workflow.py above"
                      >
                        <Sparkles size={12} />
                        <span>Insert</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopyHint(activeStepTab)}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                          copiedHint === activeStepTab
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                            : isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            : 'bg-overlay hover:bg-hairline text-fg-muted hover:text-fg border-hairline'
                        }`}
                        title="Copy snippet to clipboard"
                      >
                        {copiedHint === activeStepTab ? (
                          <>
                            <Check size={13} className="text-emerald-500" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: LIVE OPTIMIZATION FLYWHEEL EXECUTION (Gated by edges wiring) */}
      {/* ========================================================================= */}
      <div ref={executionSectionRef}>
        {!isWorkflowWired ? (
          <div className="p-8 rounded-3xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 text-center space-y-3 animate-rise">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
              <Lock size={22} />
            </div>
            <h3 className="text-base font-bold text-fg">
              Complete Workflow Wiring Above to Unlock Live Execution
            </h3>
            <p className="text-sm text-fg-muted max-w-md mx-auto font-sans">
              Wire all 3 edges in workflow.py above (Initial Sequence, Conditional Branching, and Cyclic Return Edge) to unlock the autonomous multi-round optimization engine.
            </p>
          </div>
        ) : (
          <div className="space-y-6 animate-rise">
          {/* CLI Execution Command Box */}
          <div className="p-5 rounded-2xl border border-slate-300 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs shadow-xl space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 dark:border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <Terminal size={15} className="text-cyan-700 dark:text-vibe-cyan" />
                <span className="font-bold text-slate-900 dark:text-slate-100">Cloud Shell CLI Execution</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyCommand}
                  className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white rounded-lg border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
                >
                  {copiedCommand ? (
                    <>
                      <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                      <span className="text-emerald-700 dark:text-emerald-400 font-bold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={13} />
                      <span>Copy Command</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="p-3 bg-white dark:bg-slate-950/90 rounded-xl border border-slate-300 dark:border-slate-800 text-cyan-950 dark:text-cyan-300 select-all overflow-x-auto font-mono text-xs font-bold leading-relaxed shadow-inner">
              python agentic_data_engineer/optimize_loop.py
            </div>

            <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 font-sans">
              <span>Execute the native ADK workflow loop in Cloud Shell, or launch it directly in the workbench below.</span>
            </div>
          </div>

          {/* Live Execution Control Bar */}
          <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-fg flex items-center gap-2">
                <RefreshCw size={18} className={isRunning ? 'animate-spin text-vibe-cyan' : 'text-vibe-cyan'} />
                <span>Autonomous Optimization Flywheel</span>
              </h3>
              <p className="text-sm text-fg-muted font-sans mt-0.5">
                Executes rounds iteratively until reaching convergence (&ge; 99.5 yield score) or round budget limit.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleRunFlywheel}
                disabled={isRunning}
                className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-semibold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isRunning ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-black" />
                    <span>Running Flywheel (Round {currentRound}{phase !== 'idle' ? ` · ${phase.replace(/_/g, ' ')}` : ''})...</span>
                  </>
                ) : loopCompleted ? (
                  <>
                    <RefreshCw size={14} />
                    <span>Replay Optimization Flywheel</span>
                  </>
                ) : (
                  <>
                    <Play size={14} className="fill-black" />
                    <span>Launch Optimization Flywheel</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-xs text-red-700 dark:text-red-300 font-mono">
              {errorMessage}
            </div>
          )}

          {/* Rounds Telemetry Table */}
          <div className="space-y-4">
            {completedRounds.length === 0 ? (
              <div className="p-8 bg-card rounded-3xl border border-dashed border-hairline text-center space-y-2">
                {isRunning ? (
                  <div className="flex flex-col items-center justify-center space-y-3 py-4">
                    <Loader2 size={24} className="animate-spin text-vibe-cyan" />
                    <p className="text-sm font-sans text-fg">
                      ADK 2.0 Generator Agent is synthesizing candidate policy and passing to Simulation Judge...
                    </p>
                    <span className="text-xs font-sans text-fg-muted">
                      Simulating auctions across dayparts and market shocks.
                    </span>
                  </div>
                ) : (
                  <p className="text-sm font-sans text-fg-muted">
                    The optimization loop has not run yet. Click <strong className="text-fg">"Launch Optimization Flywheel"</strong> above to begin.
                  </p>
                )}
              </div>
            ) : (
              <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-4 animate-rise">
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-mono text-xs">
                    <thead>
                      <tr className="border-b border-hairline text-fg-muted uppercase tracking-wider text-xs font-semibold">
                        <th className="py-3 px-3 font-medium">Iteration</th>
                        <th className="py-3 px-3 font-medium">Yield Score</th>
                        <th className="py-3 px-3 font-medium">Impressions</th>
                        <th className="py-3 px-3 font-medium">Total Spend</th>
                        <th className="py-3 px-3 font-medium">eCPM</th>
                        <th className="py-3 px-3 font-medium">Strategy Focus</th>
                        <th className="py-3 px-3 font-medium text-right">Verdict</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {completedRounds.map((r) => (
                        <tr 
                          key={r.round} 
                          className={`transition-all animate-rise ${
                            r.status === 'champion'
                              ? 'text-fg bg-emerald-500/10 font-medium'
                              : 'text-fg-muted hover:text-fg hover:bg-overlay/40'
                          }`}
                        >
                          <td className="py-3 px-3 font-bold text-fg whitespace-nowrap">
                            <span className="flex items-center gap-2">
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                                r.status === 'champion' 
                                  ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/30' 
                                  : 'bg-vibe-cyan/15 text-cyan-800 dark:text-vibe-cyan border border-vibe-cyan/30'
                              }`}>
                                {r.round}
                              </span>
                              <span>Round {r.round}</span>
                            </span>
                          </td>
                          <td className={`py-3 px-3 font-bold ${
                            r.score >= 95 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-400'
                          }`}>
                            {r.score} / 100
                          </td>
                          <td className="py-3 px-3 text-fg">{r.impressions}</td>
                          <td className="py-3 px-3">{r.spend}</td>
                          <td className="py-3 px-3">{r.ecpm}</td>
                          <td className="py-3 px-3 text-xs font-sans text-fg-muted">
                            {r.title.replace(/^Round \d+:\s*/, '')}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            {r.status === 'champion' ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40 text-xs font-semibold">
                                <Award size={12} />
                                <span>Crowned Champion</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-500/15 text-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-500/30 text-xs font-semibold">
                                <RefreshCw size={11} />
                                <span>Iterating</span>
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Champion Bidding Policy Viewer */}
          {loopCompleted && (
            <div className="space-y-4 animate-rise pt-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
                  <Code2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                  <span>Crowned Champion Bidding Policy {completedRounds.length > 0 ? `(Round ${completedRounds[completedRounds.length - 1].round})` : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-emerald-950 dark:text-emerald-300 font-bold bg-emerald-100 dark:bg-emerald-500/10 px-3 py-0.5 rounded-full border border-emerald-300 dark:border-emerald-500/20">
                    Score: {championScore !== null ? championScore.toFixed(1) : (completedRounds.length > 0 ? completedRounds[completedRounds.length - 1].score.toFixed(1) : '—')}/100
                  </span>
                  <button
                    type="button"
                    onClick={fetchLiveHistory}
                    title="Reload from disk (policies/agent_bidding_policy.py)"
                    className="p-1.5 rounded-lg bg-overlay hover:bg-card border border-hairline text-fg-muted hover:text-fg transition-all text-xs flex items-center gap-1 font-mono cursor-pointer"
                  >
                    <RefreshCw size={12} className={isSyncingDisk ? 'animate-spin text-emerald-400' : ''} />
                    <span className="text-xs font-semibold">Sync Disk</span>
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

                <div className="p-5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-300 dark:border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-rise shadow-sm">
                  <div className="flex items-center gap-2.5 text-xs font-mono text-emerald-950 dark:text-emerald-300">
                    <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <div>
                      <strong className="block text-fg font-sans">Champion Policy Deployed to Simulation Runtime</strong>
                      <span className="text-fg-muted text-xs font-sans">Ready to benchmark the winning policy in the full production ad serving simulator below.</span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      const el = document.getElementById('champion-simulator');
                      el?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className="px-5 py-2.5 bg-card hover:bg-overlay text-fg font-semibold rounded-xl text-xs border border-hairline transition-all flex items-center gap-2 cursor-pointer shrink-0"
                  >
                    <span>Scroll to Simulation</span>
                    <ArrowDown size={14} />
                  </button>
                </div>
              </div>

              {/* Embedded Champion Simulation Runner (Attempt 3) */}
              <div id="champion-simulator" className="pt-2">
                <Simulator navigate={navigate} activeLab={activeLab} attempt={3} embedded={true} />
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
