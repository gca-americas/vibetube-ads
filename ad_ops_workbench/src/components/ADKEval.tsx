import { useState, useRef, useEffect, type ReactNode } from 'react';
import { 
  ShieldCheck, Check, ChevronDown, ChevronUp, ArrowRight, ArrowLeft,
  RefreshCw, Sparkles, FileText, Scale, Activity, Terminal, Copy, Folder
} from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { GEMINI_MODEL } from '../config/models';

interface RawTraceEvent {
  id: number;
  badgeLabel: string;
  title: string;
  timestamp: string;
  meta: string;
  accent: {
    badgeBg: string;
    badgeText: string;
    cardBg: string;
    cardBorder: string;
    titleColor: string;
  };
  summaryNode: ReactNode;
  rawJson: Record<string, unknown>;
}

const RAW_TRACE_EVENTS: RawTraceEvent[] = [
  {
    id: 1,
    badgeLabel: 'EVENT 1',
    title: 'USER_INPUT',
    timestamp: 'T+00:00.000',
    meta: '0ms',
    accent: {
      badgeBg: 'bg-amber-100 dark:bg-amber-500/20',
      badgeText: 'text-amber-900 dark:text-amber-300',
      cardBg: 'bg-amber-50/80 dark:bg-amber-500/10',
      cardBorder: 'border-amber-200 dark:border-amber-500/30',
      titleColor: 'text-amber-900 dark:text-amber-400',
    },
    summaryNode: (
      <div className="text-slate-800 dark:text-zinc-200 text-xs sm:text-sm pl-2">
        <span className="text-slate-500 dark:text-zinc-400 font-mono">"text":</span>{' '}
        <span className="text-amber-900 dark:text-amber-200 font-medium">
          "Retrieve active campaign info, analyze auction telemetry across dayparts, and deploy compute_bid policy."
        </span>
      </div>
    ),
    rawJson: {
      event_id: 'evt_001',
      event_type: 'USER_INPUT',
      timestamp: '2026-09-04T11:42:01.120Z',
      elapsed_ms: 0,
      role: 'user',
      content: {
        text: 'Retrieve active campaign info, analyze auction telemetry across dayparts, and deploy compute_bid policy.',
      },
    },
  },
  {
    id: 2,
    badgeLabel: 'EVENT 2',
    title: 'MODEL_THINKING (Chain of Thought)',
    timestamp: 'T+00:00.820',
    meta: '820ms, 94 tokens',
    accent: {
      badgeBg: 'bg-purple-100 dark:bg-purple-500/20',
      badgeText: 'text-purple-900 dark:text-purple-300',
      cardBg: 'bg-purple-50/80 dark:bg-purple-500/10',
      cardBorder: 'border-purple-200 dark:border-purple-500/30',
      titleColor: 'text-purple-900 dark:text-purple-400',
    },
    summaryNode: (
      <div className="text-purple-950 dark:text-purple-200 text-xs sm:text-sm pl-2 italic">
        "Goal: inspect campaign constraints (budget, ceiling) -&gt; query BigQuery Data Agent for daypart market prices -&gt; formulate dynamic compute_bid formula -&gt; deploy via deploy_bidding_policy. Next action: call get_campaign_info()."
      </div>
    ),
    rawJson: {
      event_id: 'evt_002',
      event_type: 'MODEL_THINKING',
      timestamp: '2026-09-04T11:42:01.840Z',
      elapsed_ms: 820,
      role: 'model',
      thought: 'Goal: inspect campaign constraints (budget, ceiling) -> query BigQuery Data Agent for daypart market prices -> formulate dynamic compute_bid formula -> deploy via deploy_bidding_policy. Next action: call get_campaign_info().',
      tokens: {
        thought_tokens: 94,
      },
    },
  },
  {
    id: 3,
    badgeLabel: 'EVENT 3',
    title: 'TOOL_INVOCATION',
    timestamp: 'T+00:01.450',
    meta: '630ms | call_id: call_camp_01',
    accent: {
      badgeBg: 'bg-cyan-100 dark:bg-cyan-500/20',
      badgeText: 'text-cyan-950 dark:text-cyan-300',
      cardBg: 'bg-cyan-50/80 dark:bg-cyan-500/10',
      cardBorder: 'border-cyan-200 dark:border-cyan-500/30',
      titleColor: 'text-cyan-950 dark:text-cyan-400',
    },
    summaryNode: (
      <div className="text-slate-800 dark:text-zinc-200 text-xs sm:text-sm pl-2">
        <span className="text-slate-500 dark:text-zinc-400 font-mono">tool:</span>{' '}
        <span className="text-cyan-800 dark:text-cyan-300 font-bold font-mono">get_campaign_info</span>,{' '}
        <span className="text-slate-500 dark:text-zinc-400 font-mono">args:</span>{' '}
        <span className="text-slate-700 dark:text-zinc-300 font-mono">{'{}'}</span>
      </div>
    ),
    rawJson: {
      event_id: 'evt_003',
      event_type: 'TOOL_INVOCATION',
      timestamp: '2026-09-04T11:42:02.150Z',
      elapsed_ms: 1450,
      call_id: 'call_camp_01',
      function_call: {
        name: 'get_campaign_info',
        arguments: {},
      },
    },
  },
  {
    id: 4,
    badgeLabel: 'EVENT 4',
    title: 'TOOL_RESPONSE',
    timestamp: 'T+00:01.890',
    meta: '440ms | Status: 200 OK',
    accent: {
      badgeBg: 'bg-emerald-100 dark:bg-emerald-500/20',
      badgeText: 'text-emerald-950 dark:text-emerald-300',
      cardBg: 'bg-emerald-50/80 dark:bg-emerald-500/10',
      cardBorder: 'border-emerald-200 dark:border-emerald-500/30',
      titleColor: 'text-emerald-950 dark:text-emerald-400',
    },
    summaryNode: (
      <div className="text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm pl-2 font-mono">
        {'{ "daily_budget": 2500.0, "max_bid_ceiling": 10.0, "currency": "USD", "active_dayparts": ["morning", "afternoon", "primetime", "late_night"] }'}
      </div>
    ),
    rawJson: {
      event_id: 'evt_004',
      event_type: 'TOOL_RESPONSE',
      timestamp: '2026-09-04T11:42:02.680Z',
      elapsed_ms: 1890,
      call_id: 'call_camp_01',
      tool_name: 'get_campaign_info',
      status: 200,
      latency_ms: 440,
      response: {
        daily_budget: 2500.0,
        max_bid_ceiling: 10.0,
        currency: 'USD',
        active_dayparts: ['morning', 'afternoon', 'primetime', 'late_night'],
      },
    },
  },
  {
    id: 5,
    badgeLabel: 'EVENT 5',
    title: 'TOOL_INVOCATION',
    timestamp: 'T+00:02.310',
    meta: '420ms | call_id: call_bq_02',
    accent: {
      badgeBg: 'bg-cyan-100 dark:bg-cyan-500/20',
      badgeText: 'text-cyan-950 dark:text-cyan-300',
      cardBg: 'bg-cyan-50/80 dark:bg-cyan-500/10',
      cardBorder: 'border-cyan-200 dark:border-cyan-500/30',
      titleColor: 'text-cyan-950 dark:text-cyan-400',
    },
    summaryNode: (
      <div className="text-slate-800 dark:text-zinc-200 text-xs sm:text-sm pl-2 font-mono">
        <span className="text-slate-500 dark:text-zinc-400">tool:</span>{' '}
        <span className="text-cyan-800 dark:text-cyan-300 font-bold">data_agent_toolset</span>,{' '}
        <span className="text-slate-500 dark:text-zinc-400">args:</span>{' '}
        <span className="text-emerald-800 dark:text-emerald-300">
          {'{ "question": "What are historical market prices and win rates by daypart?" }'}
        </span>
      </div>
    ),
    rawJson: {
      event_id: 'evt_005',
      event_type: 'TOOL_INVOCATION',
      timestamp: '2026-09-04T11:42:03.110Z',
      elapsed_ms: 2310,
      call_id: 'call_bq_02',
      function_call: {
        name: 'data_agent_toolset',
        arguments: {
          question: 'What are historical market prices and win rates by daypart?',
        },
      },
    },
  },
  {
    id: 6,
    badgeLabel: 'EVENT 6',
    title: 'TOOL_RESPONSE (BigQuery Analytics Agent)',
    timestamp: 'T+00:04.820',
    meta: '2,510ms | Rows: 600,000',
    accent: {
      badgeBg: 'bg-emerald-100 dark:bg-emerald-500/20',
      badgeText: 'text-emerald-950 dark:text-emerald-300',
      cardBg: 'bg-emerald-50/80 dark:bg-emerald-500/10',
      cardBorder: 'border-emerald-200 dark:border-emerald-500/30',
      titleColor: 'text-emerald-950 dark:text-emerald-400',
    },
    summaryNode: (
      <div className="text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm pl-2 font-mono">
        {'{ "p90_floors": { "morning": 1.20, "afternoon": 2.10, "primetime": 9.60, "late_night": 0.85 }, "win_rates": { "morning": 0.42, "afternoon": 0.38, "primetime": 0.29, "late_night": 0.65 } }'}
      </div>
    ),
    rawJson: {
      event_id: 'evt_006',
      event_type: 'TOOL_RESPONSE',
      timestamp: '2026-09-04T11:42:05.420Z',
      elapsed_ms: 4820,
      call_id: 'call_bq_02',
      tool_name: 'data_agent_toolset',
      status: 200,
      latency_ms: 2510,
      rows_scanned: 600000,
      response: {
        p90_floors: {
          morning: 1.2,
          afternoon: 2.1,
          primetime: 9.6,
          late_night: 0.85,
        },
        win_rates: {
          morning: 0.42,
          afternoon: 0.38,
          primetime: 0.29,
          late_night: 0.65,
        },
      },
    },
  },
  {
    id: 7,
    badgeLabel: 'EVENT 7',
    title: 'TOOL_INVOCATION',
    timestamp: 'T+00:05.400',
    meta: '580ms | call_id: call_actuator_03',
    accent: {
      badgeBg: 'bg-cyan-100 dark:bg-cyan-500/20',
      badgeText: 'text-cyan-950 dark:text-cyan-300',
      cardBg: 'bg-cyan-50/80 dark:bg-cyan-500/10',
      cardBorder: 'border-cyan-200 dark:border-cyan-500/30',
      titleColor: 'text-cyan-950 dark:text-cyan-400',
    },
    summaryNode: (
      <div className="text-slate-800 dark:text-zinc-200 text-xs sm:text-sm pl-2 space-y-1">
        <div>
          <span className="text-slate-500 dark:text-zinc-400 font-mono">tool:</span>{' '}
          <span className="text-cyan-800 dark:text-cyan-300 font-bold font-mono">deploy_bidding_policy</span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-zinc-400 font-mono">args.python_code:</span>{' '}
          <span className="text-slate-700 dark:text-zinc-300 font-mono">
            "def compute_bid(context: AuctionContext) -&gt; float:
    # Dynamic P90 pacing policy with ceiling clamping
    ..."
          </span>
        </div>
        <div>
          <span className="text-slate-500 dark:text-zinc-400 font-mono">args.strategy_summary:</span>{' '}
          <span className="text-slate-700 dark:text-zinc-300 font-mono">"Adaptive daypart shading with P90 ceiling clamping"</span>
        </div>
      </div>
    ),
    rawJson: {
      event_id: 'evt_007',
      event_type: 'TOOL_INVOCATION',
      timestamp: '2026-09-04T11:42:06.010Z',
      elapsed_ms: 5400,
      call_id: 'call_actuator_03',
      function_call: {
        name: 'deploy_bidding_policy',
        arguments: {
          python_code: 'def compute_bid(context: AuctionContext) -> float:\\n    floor = context.historical_p90\\n    bid = min(floor * 1.05, 10.00)\\n    return round(bid, 2)',
          strategy_summary: 'Adaptive daypart shading with P90 ceiling clamping',
        },
      },
    },
  },
  {
    id: 8,
    badgeLabel: 'EVENT 8',
    title: 'TOOL_RESPONSE',
    timestamp: 'T+00:06.150',
    meta: '750ms | AST Validated',
    accent: {
      badgeBg: 'bg-emerald-100 dark:bg-emerald-500/20',
      badgeText: 'text-emerald-950 dark:text-emerald-300',
      cardBg: 'bg-emerald-50/80 dark:bg-emerald-500/10',
      cardBorder: 'border-emerald-200 dark:border-emerald-500/30',
      titleColor: 'text-emerald-950 dark:text-emerald-400',
    },
    summaryNode: (
      <div className="text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm pl-2 font-mono">
        {'{ "status": "deployed", "path": "policies/agent_bidding_policy.py", "ast_valid": true, "clamped_to_ceiling": true }'}
      </div>
    ),
    rawJson: {
      event_id: 'evt_008',
      event_type: 'TOOL_RESPONSE',
      timestamp: '2026-09-04T11:42:06.850Z',
      elapsed_ms: 6150,
      call_id: 'call_actuator_03',
      tool_name: 'deploy_bidding_policy',
      status: 200,
      latency_ms: 750,
      response: {
        status: 'deployed',
        path: 'policies/agent_bidding_policy.py',
        ast_valid: true,
        clamped_to_ceiling: true,
      },
    },
  },
  {
    id: 9,
    badgeLabel: 'EVENT 9',
    title: 'MODEL_RESPONSE (Final Completion)',
    timestamp: 'T+00:07.240',
    meta: '1,090ms, 580 tokens',
    accent: {
      badgeBg: 'bg-blue-100 dark:bg-blue-500/20',
      badgeText: 'text-blue-900 dark:text-blue-300',
      cardBg: 'bg-blue-50/80 dark:bg-blue-500/10',
      cardBorder: 'border-blue-200 dark:border-blue-500/30',
      titleColor: 'text-blue-900 dark:text-blue-400',
    },
    summaryNode: (
      <div className="text-slate-800 dark:text-zinc-200 text-xs sm:text-sm pl-2">
        "Successfully analyzed auction telemetry and deployed production bidding policy to policies/agent_bidding_policy.py with $10.00 ceiling protection."
      </div>
    ),
    rawJson: {
      event_id: 'evt_009',
      event_type: 'MODEL_RESPONSE',
      timestamp: '2026-09-04T11:42:07.240Z',
      elapsed_ms: 7240,
      role: 'model',
      finish_reason: 'STOP',
      usage: {
        prompt_tokens: 1420,
        completion_tokens: 580,
        total_tokens: 2000,
      },
      content: {
        text: 'Successfully analyzed auction telemetry and deployed production bidding policy to policies/agent_bidding_policy.py with $10.00 ceiling protection.',
      },
    },
  },
];

const EVAL_LOG_PART_1 = `$ adk eval . eval/adk_eval_set.json --config_file_path eval/eval_config.json --print_detailed_results

[INFO] Initializing ADK evaluation benchmark: vibetube_campaign_eval_set
[INFO] Loaded LLM-as-a-Judge configuration: eval/eval_config.json
  ├── Criteria 1: tool_trajectory_avg_score (Threshold: 1.0, Match: in_order)
  └── Criteria 2: final_response_match_v2 (Threshold: 0.70, Model: ${GEMINI_MODEL}, Samples: 3)`;

const EVAL_LOG_PART_2 = `

[INFO] Executing trajectory for agent: bidding_policy_agent
  ├── Step 1: Tool get_campaign_info() -> Status: 200 OK
  ├── Step 2: Tool data_agent_toolset("Analyze historical market prices by daypart") -> 600,000 auctions scanned
  └── Step 3: Tool deploy_bidding_policy(code, summary) -> AST Validated, Deployed to production`;

const EVAL_LOG_PART_3 = `

[LLM-AS-A-JUDGE] Multi-sample evaluation across Google Enterprise Agent Platform...
  ✓ Tool Trajectory: Pass (1.00 / 1.00) - Required tools executed in correct sequence (in_order)
  ✓ Code Guardrails: Pass (1.00 / 1.00) - AST syntax valid, ceiling clamped to max_bid_ceiling
  ✓ Semantic Match:  Pass (0.98 / 1.00) - Policy correctly implements dynamic budget pacing`;

const EVAL_LOG_PART_4 = `

*********************************************************************
Eval Run Summary
vibetube_campaign_eval_set:
  Tests passed: 1
  Tests failed: 0
*********************************************************************
Result: PASSED (Combined Benchmark Score: 0.98 / 1.00)`;

export default function ADKEval({ navigate }: { navigate: (v: string) => void }) {
  const { t } = useTranslation();
  const [activeStage, setActiveStage] = useState<'trace' | 'benchmark' | 'rubric' | 'execution'>('trace');
  const [expandedEvents, setExpandedEvents] = useState<Record<number, boolean>>({});
  const [isEvalRunning, setIsEvalRunning] = useState(false);
  const [evalCompleted, setEvalCompleted] = useState(false);
  const [evalStep, setEvalStep] = useState<number>(0);
  const [evalOutput, setEvalOutput] = useState<string>('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const timeoutsRef = useRef<number[]>([]);
  const terminalRef = useRef<HTMLPreElement>(null);

  const clearAllTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => {
    return () => clearAllTimeouts();
  }, []);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [evalOutput]);

  const handleCopy = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const toggleEventExpanded = (id: number) => {
    setExpandedEvents(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const allEventsExpanded = RAW_TRACE_EVENTS.every(evt => !!expandedEvents[evt.id]);

  const toggleAllEvents = () => {
    if (allEventsExpanded) {
      setExpandedEvents({});
    } else {
      const next: Record<number, boolean> = {};
      RAW_TRACE_EVENTS.forEach(evt => {
        next[evt.id] = true;
      });
      setExpandedEvents(next);
    }
  };

  const handleRunEval = () => {
    clearAllTimeouts();
    setIsEvalRunning(true);
    setEvalCompleted(false);
    setEvalStep(1);

    setEvalOutput(EVAL_LOG_PART_1);

    const t1 = window.setTimeout(() => {
      setEvalOutput(EVAL_LOG_PART_1 + EVAL_LOG_PART_2);
      setEvalStep(2);
    }, 700);

    const t2 = window.setTimeout(() => {
      setEvalOutput(EVAL_LOG_PART_1 + EVAL_LOG_PART_2 + EVAL_LOG_PART_3);
      setEvalStep(3);
    }, 1500);

    const t3 = window.setTimeout(() => {
      setEvalOutput(EVAL_LOG_PART_1 + EVAL_LOG_PART_2 + EVAL_LOG_PART_3 + EVAL_LOG_PART_4);
      setEvalStep(4);
      setIsEvalRunning(false);
      setEvalCompleted(true);
    }, 2300);

    timeoutsRef.current = [t1, t2, t3];
  };

  const handleBackToRubric = () => {
    clearAllTimeouts();
    setIsEvalRunning(false);
    setActiveStage('rubric');
  };

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* 4-Stage Guided Stepper */}
      <div className="p-6 sm:p-8 bg-card rounded-3xl border border-hairline shadow-xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-hairline pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-fg flex items-center gap-2">
                <code className="font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-lg text-sm">
                  adk eval
                </code>
                <span>{t('adkEval.title')}</span>
              </h3>
              <span className="text-sm font-mono text-fg-muted">{t('adkEval.subtitle')}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Stepper Navigation */}
            <div className="flex items-center gap-1.5 bg-overlay/60 p-1.5 rounded-2xl border border-hairline overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveStage('trace')}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeStage === 'trace'
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-card/70'
                }`}
              >
                <Activity size={14} />
                <span>{t('adkEval.stages.trace')}</span>
              </button>
              <span className="text-fg-muted text-xs">→</span>
              <button
                type="button"
                onClick={() => setActiveStage('benchmark')}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeStage === 'benchmark'
                    ? 'bg-cyan-500 text-black shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-card/70'
                }`}
              >
                <FileText size={14} />
                <span>{t('adkEval.stages.benchmark')}</span>
              </button>
              <span className="text-fg-muted text-xs">→</span>
              <button
                type="button"
                onClick={() => setActiveStage('rubric')}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeStage === 'rubric'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-card/70'
                }`}
              >
                <Scale size={14} />
                <span>{t('adkEval.stages.rubric')}</span>
              </button>
              <span className="text-fg-muted text-xs">→</span>
              <button
                type="button"
                onClick={() => setActiveStage('execution')}
                className={`px-3.5 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                  activeStage === 'execution'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-card/70'
                }`}
              >
                <ShieldCheck size={13} />
                <span>{t('adkEval.stages.execution')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* STAGE 1: Session Trace Stream */}
        {/* ========================================================================= */}
        {activeStage === 'trace' && (
          <div className="space-y-6 animate-rise">
            {/* Top CLI Inspection Box */}
            <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs shadow-md space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Terminal size={15} className="text-amber-600 dark:text-amber-400" />
                  <span className="font-bold text-slate-900 dark:text-slate-100">{t('adkEval.trace.cliTitle')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy('cat session_recording_trace.jsonl', 'trace_cat')}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white rounded-lg border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
                  >
                    {copiedKey === 'trace_cat' ? (
                      <>
                        <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('adkEval.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>{t('adkEval.copyCommand')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-950/90 rounded-xl border border-slate-300 dark:border-slate-800 text-amber-900 dark:text-amber-300 select-all overflow-x-auto font-mono text-xs font-bold shadow-inner">
                cat session_recording_trace.jsonl
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 font-sans">
                <Folder size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
                <span>
                  <Trans i18nKey="adkEval.trace.location" components={{ c: <code className="font-mono text-slate-900 dark:text-slate-300 font-bold" /> }} />
                </span>
              </div>
            </div>

            {/* Trace Stream Viewer */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-fg-muted">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-fg">{t('adkEval.trace.streamLabel')}</span>
                  <span className="text-fg-muted font-sans text-sm">{t('adkEval.trace.streamDesc')}</span>
                </div>
                <button
                  type="button"
                  onClick={toggleAllEvents}
                  className="px-3.5 py-1.5 rounded-xl text-xs font-semibold border border-hairline bg-card hover:bg-overlay text-fg transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-sm"
                >
                  <span className="text-amber-500 font-bold">{'{ }'}</span>
                  <span>{allEventsExpanded ? t('adkEval.trace.collapseAll') : t('adkEval.trace.expandAll')}</span>
                  {allEventsExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>
              </div>

              {/* Event Cards Stream */}
              <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0c0c14] p-4 sm:p-5 text-xs font-mono leading-relaxed space-y-3.5 max-h-[640px] overflow-y-auto shadow-inner">
                {RAW_TRACE_EVENTS.map(event => {
                  const isExpanded = !!expandedEvents[event.id];
                  return (
                    <div
                      key={event.id}
                      className={`p-3.5 rounded-xl ${event.accent.cardBg} border ${event.accent.cardBorder} space-y-2 transition-all shadow-sm`}
                    >
                      <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2.5 py-0.5 rounded-lg ${event.accent.badgeBg} ${event.accent.badgeText} text-xs font-semibold font-mono`}
                          >
                            {event.badgeLabel}
                          </span>
                          <span className={`${event.accent.titleColor} font-bold font-mono text-sm`}>
                            {event.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-fg-muted text-xs font-mono">
                            {event.timestamp} ({event.meta})
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleEventExpanded(event.id)}
                            className="p-1 hover:bg-overlay rounded-lg text-fg-muted hover:text-fg transition-colors cursor-pointer"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="text-xs text-fg-muted font-sans">{event.summaryNode}</div>

                      {isExpanded && (
                        <div className="pt-2 border-t border-hairline animate-fade-in space-y-2">
                          <div className="text-xs text-fg-muted font-mono font-bold flex items-center justify-between">
                            <span>{t('adkEval.trace.rawPayload')}</span>
                          </div>
                          <pre className="p-3 bg-white dark:bg-black/60 rounded-lg border border-slate-200 dark:border-zinc-800/80 overflow-x-auto text-xs font-mono leading-relaxed text-slate-900 dark:text-zinc-300">
                            {JSON.stringify(event.rawJson, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Stage 1 Bottom: Dedicated CLI Box & Navigation */}
            <div className="space-y-4">
              {/* Dedicated Copyable Command Box for adk eval_set create */}
              <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs shadow-md space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 dark:border-slate-800 pb-2.5">
                  <div className="flex items-center gap-2">
                    <Terminal size={15} className="text-cyan-700 dark:text-cyan-400" />
                    <span className="font-bold text-slate-900 dark:text-slate-100">{t('adkEval.trace.extractTitle')}</span>
                  </div>
                  <button
                    onClick={() => handleCopy('adk eval_set create . vibetube_campaign_eval_set', 'eval_set_create')}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white rounded-lg border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
                  >
                    {copiedKey === 'eval_set_create' ? (
                      <>
                        <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('adkEval.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>{t('adkEval.copyCommand')}</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="p-2.5 bg-white dark:bg-slate-950/90 rounded-xl border border-slate-300 dark:border-slate-800 text-cyan-950 dark:text-cyan-300 select-all overflow-x-auto font-mono text-xs font-bold shadow-inner">
                  adk eval_set create . vibetube_campaign_eval_set
                </div>

                <div className="text-sm text-slate-600 dark:text-slate-400 font-sans">
                  <Trans i18nKey="adkEval.trace.extractHint" components={{ c: <code className="font-mono text-slate-900 dark:text-slate-300 font-bold" /> }} />
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStage('benchmark')}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-black font-semibold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span>{t('adkEval.run')}</span>
                    <code className="font-mono bg-black/10 dark:bg-white/20 px-1.5 py-0.5 rounded text-xs font-bold">adk eval_set create</code>
                  </span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 2: Extracted Benchmark Scenario (adk_eval_set.json) */}
        {/* ========================================================================= */}
        {activeStage === 'benchmark' && (
          <div className="space-y-6 animate-rise">
            {/* Top CLI Inspection Box */}
            <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs shadow-md space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Terminal size={15} className="text-cyan-700 dark:text-cyan-400" />
                  <span className="font-bold text-slate-900 dark:text-slate-100">{t('adkEval.benchmark.cliTitle')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy('cat eval/adk_eval_set.json', 'benchmark_cat')}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white rounded-lg border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
                  >
                    {copiedKey === 'benchmark_cat' ? (
                      <>
                        <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('adkEval.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>{t('adkEval.copyCommand')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-950/90 rounded-xl border border-slate-300 dark:border-slate-800 text-cyan-950 dark:text-cyan-300 select-all overflow-x-auto font-mono text-xs font-bold shadow-inner">
                cat eval/adk_eval_set.json
              </div>

              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 font-sans">
                <Folder size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
                <span>
                  <Trans i18nKey="adkEval.evalFileLocation" values={{ file: 'adk_eval_set.json' }} components={{ c: <code className="font-mono text-slate-900 dark:text-slate-300 font-bold" /> }} />
                </span>
              </div>
            </div>

            {/* High-Fidelity Benchmark JSON Viewer */}
            <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0c0c14] p-5 sm:p-6 text-xs sm:text-sm font-mono leading-relaxed space-y-2 shadow-inner">
              <div className="text-slate-600 dark:text-zinc-400">{"{"}</div>
              <div className="text-slate-800 dark:text-zinc-300 pl-4">
                <span className="text-slate-950 dark:text-white font-bold">"eval_set_id"</span>: <span className="text-cyan-700 dark:text-cyan-300">"vibetube_campaign_eval_set"</span>,
              </div>
              <div className="text-slate-600 dark:text-zinc-400 pl-4">"eval_cases": [{"{"}</div>
              
              {/* Part 1: user_content */}
              <div className="text-amber-900 dark:text-amber-400 pl-8 bg-amber-500/10 py-2.5 px-3 rounded-xl border-l-4 border-amber-500 my-2">
                <span className="text-slate-950 dark:text-white font-bold">"user_content"</span>: {"{"}
                <div className="text-amber-950 dark:text-amber-200 pl-4 py-0.5">
                  <span className="text-slate-600 dark:text-zinc-400">"text"</span>: "Retrieve active campaign info, analyze auction telemetry across dayparts, and deploy compute_bid policy."
                </div>
                <div>{"},"}</div>
              </div>

              {/* Part 2: intermediate_data.invocation_events */}
              <div className="text-cyan-950 dark:text-cyan-400 pl-8 bg-cyan-500/10 py-2.5 px-3 rounded-xl border-l-4 border-cyan-500 my-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-950 dark:text-white font-bold">"intermediate_data"</span>: {"{"}
                  <span className="text-xs font-semibold bg-cyan-500/20 text-cyan-950 dark:text-cyan-300 px-2.5 py-0.5 rounded-lg border border-cyan-500/30">
                    {t('adkEval.benchmark.gradedBy', { metric: 'tool_trajectory_avg_score' })}
                  </span>
                </div>
                <div className="text-cyan-900 dark:text-cyan-300 pl-4">
                  <span className="text-slate-950 dark:text-white font-bold">"invocation_events"</span>: [
                  <div className="pl-4 text-slate-800 dark:text-zinc-300 py-1">
                    1. {"{"} <span className="text-cyan-800 dark:text-cyan-300">"name"</span>: <span className="text-emerald-700 dark:text-emerald-400 font-bold">"get_campaign_info"</span>, <span className="text-slate-500 dark:text-zinc-400">"args"</span>: {"{}"} {"},"}
                  </div>
                  <div className="pl-4 text-slate-800 dark:text-zinc-300 py-1">
                    2. {"{"} <span className="text-cyan-800 dark:text-cyan-300">"name"</span>: <span className="text-emerald-700 dark:text-emerald-400 font-bold">"data_agent_toolset"</span>, <span className="text-slate-500 dark:text-zinc-400">"args"</span>: {"{"} <span className="text-slate-500 dark:text-zinc-400">"question"</span>: <span className="text-emerald-800 dark:text-emerald-300">"historical P90..."</span> {"}"} {"},"}
                  </div>
                  <div className="pl-4 text-slate-800 dark:text-zinc-300 py-1">
                    3. {"{"} <span className="text-cyan-800 dark:text-cyan-300">"name"</span>: <span className="text-emerald-700 dark:text-emerald-400 font-bold">"deploy_bidding_policy"</span>, <span className="text-slate-500 dark:text-zinc-400">"args"</span>: {"{"} <span className="text-slate-500 dark:text-zinc-400">"python_code"</span>: <span className="text-emerald-800 dark:text-emerald-300">"..."</span>, <span className="text-slate-500 dark:text-zinc-400">"strategy_summary"</span>: <span className="text-emerald-800 dark:text-emerald-300">"..."</span> {"}"} {"}"}
                  </div>
                  ]
                </div>
                <div>{"},"}</div>
              </div>

              {/* Part 3: final_response */}
              <div className="text-emerald-950 dark:text-emerald-400 pl-8 bg-emerald-500/10 py-2.5 px-3 rounded-xl border-l-4 border-emerald-500 my-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-950 dark:text-white font-bold">"final_response"</span>: {"{"}
                  <span className="text-xs font-semibold bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 px-2.5 py-0.5 rounded-lg border border-emerald-500/30">
                    {t('adkEval.benchmark.gradedBy', { metric: 'final_response_match_v2' })}
                  </span>
                </div>
                <div className="text-emerald-950 dark:text-emerald-200 pl-4 py-0.5">
                  <span className="text-slate-600 dark:text-zinc-400">"text"</span>: "Successfully analyzed auction telemetry and deployed production bidding policy to policies/agent_bidding_policy.py."
                </div>
                <div>{"}"}</div>
              </div>

              <div className="text-slate-600 dark:text-zinc-400 pl-4">{"}]"}</div>
              <div className="text-slate-600 dark:text-zinc-400">{"}"}</div>
            </div>

            {/* Navigation Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => setActiveStage('trace')}
                className="px-4 py-2 text-fg-muted hover:text-fg text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft size={15} />
                <span>{t('adkEval.back')}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveStage('rubric')}
                className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-black font-semibold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
              >
                <span className="flex items-center gap-1.5">
                  <span>{t('adkEval.view')}</span>
                  <code className="font-mono bg-black/10 dark:bg-white/20 px-1.5 py-0.5 rounded text-xs font-bold">eval_config.json</code>
                </span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 3: Grading Rubric & Vertical Pairing (eval_config.json) */}
        {/* ========================================================================= */}
        {activeStage === 'rubric' && (
          <div className="space-y-6 animate-rise">
            {/* Top CLI Inspection Box */}
            <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs shadow-md space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Terminal size={15} className="text-blue-600 dark:text-blue-400" />
                  <span className="font-bold text-slate-900 dark:text-slate-100">{t('adkEval.rubric.cliTitle')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy('cat eval/eval_config.json', 'rubric_cat')}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white rounded-lg border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
                  >
                    {copiedKey === 'rubric_cat' ? (
                      <>
                        <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('adkEval.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>{t('adkEval.copyCommand')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-2.5 bg-white dark:bg-slate-950/90 rounded-xl border border-slate-300 dark:border-slate-800 text-blue-950 dark:text-cyan-300 select-all overflow-x-auto font-mono text-xs font-bold shadow-inner">
                cat eval/eval_config.json
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 font-sans">
                <Folder size={13} className="text-slate-500 dark:text-slate-400 shrink-0" />
                <span>
                  <Trans i18nKey="adkEval.evalFileLocation" values={{ file: 'eval_config.json' }} components={{ c: <code className="font-mono text-slate-900 dark:text-slate-300 font-bold" /> }} />
                </span>
              </div>
            </div>

            {/* Vertically Stacked Full-Width Pairing */}
            <div className="space-y-6">
              {/* Stack 1: Benchmark Golden Reference */}
              <div className="p-5 sm:p-6 bg-card rounded-2xl border border-hairline space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-hairline">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-500" />
                    <span className="text-sm font-mono font-bold text-fg">{t('adkEval.rubric.contractsTitle')}</span>
                  </div>
                  <code className="text-xs font-mono text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-2.5 py-0.5 rounded-lg border border-cyan-500/30">
                    eval/adk_eval_set.json
                  </code>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0c0c14] p-4 text-xs sm:text-sm font-mono leading-relaxed space-y-2">
                  <div className="text-slate-600 dark:text-zinc-400 text-sm font-mono font-medium">{t('adkEval.rubric.contractsComment')}</div>
                  <div className="text-cyan-950 dark:text-cyan-400 bg-cyan-500/10 p-3 rounded-xl border-l-4 border-cyan-500">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-slate-950 dark:text-white font-bold">"invocation_events"</span>
                      <span className="text-xs font-mono font-bold text-cyan-800 dark:text-cyan-300 bg-cyan-500/20 px-2 py-0.5 rounded border border-cyan-500/30">
                        {t('adkEval.rubric.evaluatedByCriteria1')}
                      </span>
                    </div>
                    <div className="text-slate-800 dark:text-zinc-300 pl-2 space-y-0.5">
                      <div>1. <code className="text-cyan-800 dark:text-cyan-300 font-bold">get_campaign_info</code> {'{}'}</div>
                      <div>2. <code className="text-cyan-800 dark:text-cyan-300 font-bold">data_agent_toolset</code> {'{ "question": "..." }'}</div>
                      <div>3. <code className="text-cyan-800 dark:text-cyan-300 font-bold">deploy_bidding_policy</code> {'{ "python_code": "...", "strategy_summary": "..." }'}</div>
                    </div>
                  </div>

                  <div className="text-emerald-950 dark:text-emerald-400 bg-emerald-500/10 p-3 rounded-xl border-l-4 border-emerald-500">
                    <div className="flex items-center justify-between pb-1">
                      <span className="text-slate-950 dark:text-white font-bold">"final_response"</span>
                      <span className="text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded border border-emerald-500/30">
                        {t('adkEval.rubric.evaluatedByCriteria23')}
                      </span>
                    </div>
                    <div className="text-emerald-950 dark:text-emerald-200 pl-2 text-xs leading-relaxed">
                      "Successfully analyzed auction telemetry and deployed production bidding policy to policies/agent_bidding_policy.py."
                    </div>
                  </div>
                </div>
              </div>

              {/* Stack 2: Actual Authentic eval_config.json Schema */}
              <div className="p-5 sm:p-6 bg-card rounded-2xl border border-hairline space-y-3 shadow-sm">
                <div className="flex items-center justify-between pb-2 border-b border-hairline">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-sm font-mono font-bold text-fg">{t('adkEval.rubric.rubricTitle')}</span>
                  </div>
                  <code className="text-xs font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-lg border border-blue-500/30">
                    eval/eval_config.json
                  </code>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#0c0c14] p-4 text-xs sm:text-sm font-mono leading-relaxed space-y-2">
                  <div className="text-slate-600 dark:text-zinc-400 text-sm font-mono font-medium">{t('adkEval.rubric.rubricComment')}</div>
                  <div className="text-slate-600 dark:text-zinc-400">{"{"}</div>
                  <div className="text-slate-600 dark:text-zinc-400 pl-4">"criteria": {"{"}</div>

                  {/* Criteria 1 */}
                  <div className="text-cyan-950 dark:text-cyan-400 pl-8 bg-cyan-500/10 py-2.5 px-3 rounded-xl border-l-4 border-cyan-500 my-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-950 dark:text-white font-bold">"tool_trajectory_avg_score"</span>: {"{"}
                      <span className="text-xs font-mono font-bold bg-cyan-500/20 text-cyan-950 dark:text-cyan-300 px-2 py-0.5 rounded-lg border border-cyan-500/30">
                        {t('adkEval.rubric.grades', { field: 'invocation_events' })}
                      </span>
                    </div>
                    <div className="text-cyan-900 dark:text-cyan-300 pl-4 py-0.5">
                      "threshold": <span className="text-slate-950 dark:text-white font-bold">1.0</span>,
                    </div>
                    <div className="text-cyan-900 dark:text-cyan-300 pl-4 py-0.5">
                      "match_type": <span className="text-emerald-700 dark:text-emerald-400 font-bold">"in_order"</span>
                    </div>
                    <div>{"},"}</div>
                  </div>

                  {/* Criteria 2 */}
                  <div className="text-emerald-950 dark:text-emerald-400 pl-8 bg-emerald-500/10 py-2.5 px-3 rounded-xl border-l-4 border-emerald-500 my-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-950 dark:text-white font-bold">"final_response_match_v2"</span>: {"{"}
                      <span className="text-xs font-mono font-bold bg-emerald-500/20 text-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                        {t('adkEval.rubric.grades', { field: 'final_response' })}
                      </span>
                    </div>
                    <div className="text-emerald-900 dark:text-emerald-300 pl-4 py-0.5">
                      "threshold": <span className="text-slate-950 dark:text-white font-bold">0.7</span>,
                    </div>
                    <div className="text-emerald-900 dark:text-emerald-300 pl-4 py-0.5">
                      "judge_model_options": {`{ "judge_model": "${GEMINI_MODEL}", "num_samples": 3 }`}
                    </div>
                    <div>{"}"}</div>
                  </div>

                  <div className="text-slate-600 dark:text-zinc-400 pl-4">{"}"}</div>
                  <div className="text-slate-600 dark:text-zinc-400">{"}"}</div>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => setActiveStage('benchmark')}
                  className="px-4 py-2 text-fg-muted hover:text-fg text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <ArrowLeft size={15} />
                  <span>{t('adkEval.back')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveStage('execution')}
                  className="px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 dark:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-black font-semibold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <span>{t('adkEval.run')}</span>
                    <code className="font-mono bg-black/10 dark:bg-white/20 px-1.5 py-0.5 rounded text-xs font-bold">adk eval</code>
                  </span>
                  <ArrowRight size={15} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* STAGE 4: Live Evaluation Run & Detailed Scorecard */}
        {/* ========================================================================= */}
        {activeStage === 'execution' && (
          <div className="space-y-6 animate-rise">
            {/* Top CLI Execution Box */}
            <div className="p-4 rounded-2xl border border-slate-300 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs shadow-md space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 dark:border-slate-800 pb-2.5">
                <div className="flex items-center gap-2">
                  <Terminal size={15} className="text-emerald-700 dark:text-emerald-400" />
                  <span className="font-bold text-slate-900 dark:text-slate-100">{t('adkEval.execution.cliTitle')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleCopy('adk eval . eval/adk_eval_set.json --config_file_path eval/eval_config.json --print_detailed_results', 'eval_run')}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white rounded-lg border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
                  >
                    {copiedKey === 'eval_run' ? (
                      <>
                        <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">{t('adkEval.copied')}</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>{t('adkEval.copyCommand')}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-slate-950/90 rounded-xl border border-slate-300 dark:border-slate-800 text-emerald-900 dark:text-emerald-300 select-all overflow-x-auto font-mono text-xs font-bold leading-relaxed shadow-inner">
                adk eval . eval/adk_eval_set.json --config_file_path eval/eval_config.json --print_detailed_results
              </div>

              <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400 font-sans">
                <span><Trans i18nKey="adkEval.execution.runHint" components={{ c: <code className="font-mono text-slate-900 dark:text-slate-300 font-bold" /> }} /></span>
              </div>
            </div>

            {/* Run Trigger Bar */}
            <div className="p-5 bg-card rounded-2xl border border-hairline shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-base font-bold text-fg flex items-center gap-2">
                  <ShieldCheck size={18} className="text-emerald-600 dark:text-emerald-400" />
                  <span>{t('adkEval.execution.evaluatorTitle')}</span>
                </h4>
                <p className="text-sm text-fg-muted font-sans mt-0.5">
                  {t('adkEval.execution.evaluatorDesc', { model: GEMINI_MODEL })}
                </p>
              </div>

              <button
                onClick={handleRunEval}
                disabled={isEvalRunning}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
              >
                {isEvalRunning ? (
                  <>
                    <RefreshCw size={14} className="animate-spin text-white" />
                    <span>{t('adkEval.execution.evaluating')}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck size={14} />
                    <span>{evalCompleted ? t('adkEval.execution.rerun') : t('adkEval.execution.runEval')}</span>
                  </>
                )}
              </button>
            </div>

            {/* Uncollapsed Terminal Output (User Requested) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono text-fg-muted">
                <span className="font-bold text-fg">{t('adkEval.execution.terminalTitle')}</span>
                {isEvalRunning ? (
                  <span className="text-xs text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1.5">
                    <RefreshCw size={12} className="animate-spin" />
                    <span>{t('adkEval.execution.evaluatingStep', { step: evalStep })}</span>
                  </span>
                ) : evalCompleted ? (
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">{t('adkEval.execution.statusPassed')}</span>
                ) : (
                  <span className="text-xs text-fg-muted font-bold">{t('adkEval.execution.statusReady')}</span>
                )}
              </div>
              <div className="rounded-2xl border border-slate-300 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900 p-5 text-xs sm:text-sm font-mono text-slate-900 dark:text-slate-200 overflow-x-auto shadow-inner leading-relaxed min-h-[160px]">
                <pre ref={terminalRef} className="whitespace-pre">
                  {evalOutput || `$ adk eval . eval/adk_eval_set.json --config_file_path eval/eval_config.json --print_detailed_results\n\n[READY] Click "Run adk eval" to start the evaluation pipeline.`}
                </pre>
              </div>
            </div>

            {/* LLM-as-a-Judge Evaluation Scorecard */}
            <div className={`p-6 rounded-2xl border transition-all duration-500 ${
              evalCompleted
                ? 'border-emerald-300 dark:border-emerald-500/40 bg-emerald-50/80 dark:bg-emerald-500/10'
                : 'border-slate-300 dark:border-slate-700/60 bg-slate-50 dark:bg-slate-900/50'
            } space-y-4 shadow-sm`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className={`flex items-center gap-2 text-sm font-mono font-bold ${
                  evalCompleted ? 'text-emerald-950 dark:text-emerald-200' : 'text-fg'
                }`}>
                  <ShieldCheck size={18} className={evalCompleted ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'} />
                  <span>{t('adkEval.execution.scorecardTitle')}</span>
                </div>
                {isEvalRunning ? (
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-500/20 text-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-500/40 font-bold self-start sm:self-auto shadow-sm flex items-center gap-1.5">
                    <RefreshCw size={11} className="animate-spin" />
                    <span>{t('adkEval.execution.gradingStep', { step: evalStep })}</span>
                  </span>
                ) : evalCompleted ? (
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-500/20 text-emerald-950 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-500/40 font-bold self-start sm:self-auto shadow-sm">
                    {t('adkEval.execution.testsPassed')}
                  </span>
                ) : (
                  <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-200 dark:bg-slate-800 text-fg-muted font-bold self-start sm:self-auto">
                    {t('adkEval.execution.readyToEvaluate')}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="p-4 bg-card rounded-xl border border-hairline space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase text-fg-muted">{t('adkEval.execution.trajectoryFlow')}</span>
                    {evalStep >= 2 ? (
                      <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">{t('adkEval.execution.pass', { score: '1.00' })}</span>
                    ) : isEvalRunning ? (
                      <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <RefreshCw size={10} className="animate-spin" /> {t('adkEval.execution.verifying')}
                      </span>
                    ) : (
                      <span className="text-xs font-mono font-bold text-fg-muted">{t('adkEval.execution.pending')}</span>
                    )}
                  </div>
                  <div className="w-full bg-overlay rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${
                      evalStep >= 2 ? 'bg-emerald-500 w-full' : isEvalRunning ? 'bg-amber-500 w-1/3 animate-pulse' : 'bg-transparent w-0'
                    }`} />
                  </div>
                  <p className="text-sm text-fg-muted font-sans leading-relaxed">
                    <Trans i18nKey="adkEval.execution.trajectoryDesc" components={{ c: <code className="text-fg font-mono" /> }} />
                  </p>
                </div>

                <div className="p-4 bg-card rounded-xl border border-hairline space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase text-fg-muted">{t('adkEval.execution.codeGuardrails')}</span>
                    {evalStep >= 3 ? (
                      <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">{t('adkEval.execution.pass', { score: '1.00' })}</span>
                    ) : isEvalRunning ? (
                      <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <RefreshCw size={10} className="animate-spin" /> {t('adkEval.execution.verifying')}
                      </span>
                    ) : (
                      <span className="text-xs font-mono font-bold text-fg-muted">{t('adkEval.execution.pending')}</span>
                    )}
                  </div>
                  <div className="w-full bg-overlay rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${
                      evalStep >= 3 ? 'bg-emerald-500 w-full' : isEvalRunning ? 'bg-amber-500 w-1/3 animate-pulse' : 'bg-transparent w-0'
                    }`} />
                  </div>
                  <p className="text-sm text-fg-muted font-sans leading-relaxed">
                    <Trans i18nKey="adkEval.execution.guardrailsDesc" components={{ c: <code className="text-fg font-mono" /> }} />
                  </p>
                </div>

                <div className="p-4 bg-card rounded-xl border border-hairline space-y-2 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold uppercase text-fg-muted">{t('adkEval.execution.semanticObjective')}</span>
                    {evalStep >= 3 ? (
                      <span className="text-xs font-mono font-bold text-emerald-700 dark:text-emerald-400">{t('adkEval.execution.pass', { score: '0.98' })}</span>
                    ) : isEvalRunning ? (
                      <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                        <RefreshCw size={10} className="animate-spin" /> {t('adkEval.execution.samplingJudge')}
                      </span>
                    ) : (
                      <span className="text-xs font-mono font-bold text-fg-muted">{t('adkEval.execution.pending')}</span>
                    )}
                  </div>
                  <div className="w-full bg-overlay rounded-full h-2 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${
                      evalStep >= 3 ? 'bg-emerald-500 w-[98%]' : isEvalRunning ? 'bg-amber-500 w-1/3 animate-pulse' : 'bg-transparent w-0'
                    }`} />
                  </div>
                  <p className="text-sm text-fg-muted font-sans leading-relaxed">
                    {t('adkEval.execution.semanticDesc')}
                  </p>
                </div>
              </div>
            </div>

            {/* Post-Eval Transition Bridge (User Requests 6 & 7) */}
            {evalCompleted && (
              <div className="p-6 sm:p-7 rounded-3xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-indigo-500/5 to-purple-500/10 space-y-5 shadow-lg animate-rise">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30 shadow-sm">
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-fg">
                      {t('adkEval.execution.nextTitle')}
                    </h4>
                    <p className="text-sm text-fg-muted font-sans">
                      <Trans i18nKey="adkEval.execution.nextSubtitle" components={{ c: <code className="text-blue-600 dark:text-blue-400 font-mono font-bold" /> }} />
                    </p>
                  </div>
                </div>

                {/* 2-Column Comparison: Contract Validation vs Market Verification */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-sans">
                  {/* Column 1: ADK Eval */}
                  <div className="p-4 rounded-2xl bg-card border border-hairline space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs">
                        {t('adkEval.execution.contractTitle')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 text-xs font-mono font-bold">
                        {t('adkEval.execution.passedBadge')}
                      </span>
                    </div>
                    <p className="font-semibold text-fg text-sm italic">
                      {t('adkEval.execution.contractQuestion')}
                    </p>
                    <p className="text-sm text-fg-muted leading-relaxed">
                      {t('adkEval.execution.contractDesc')}
                    </p>
                  </div>

                  {/* Column 2: Judge Agent */}
                  <div className="p-4 rounded-2xl bg-card border border-hairline space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-purple-600 dark:text-purple-400 text-xs">
                        {t('adkEval.execution.marketTitle')}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-800 dark:text-purple-300 border border-purple-500/40 text-xs font-mono font-bold">
                        {t('adkEval.execution.marketBadge')}
                      </span>
                    </div>
                    <p className="font-semibold text-fg text-sm italic">
                      {t('adkEval.execution.marketQuestion')}
                    </p>
                    <p className="text-sm text-fg-muted leading-relaxed">
                      {t('adkEval.execution.marketDesc')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Actions */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={handleBackToRubric}
                className="px-4 py-2 text-fg-muted hover:text-fg text-sm font-semibold transition-colors flex items-center gap-2 cursor-pointer"
              >
                <ArrowLeft size={15} />
                <span>{t('adkEval.back')}</span>
              </button>

              {evalCompleted && (
                <button
                  onClick={() => navigate('judge_agent')}
                  className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-semibold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0 animate-rise"
                >
                  <span>{t('adkEval.execution.proceed')}</span>
                  <ArrowRight size={15} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
