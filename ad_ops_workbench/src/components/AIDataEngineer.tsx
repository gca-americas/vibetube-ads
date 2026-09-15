import { useState, useEffect, useRef } from 'react';
import {
  Code2, Database,
  ArrowRight, Cpu, Bot, Check,
  FileText, AlertTriangle,
  Copy, Play, RefreshCw, Terminal, Lock, FileCode2, Lightbulb, MessageSquare, Clock,
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';

type ToolId = 'get_campaign_info' | 'a2a_bigquery' | 'deploy_bidding_policy';
type StepId = 'prompt' | ToolId;

interface StepTabItem {
  id: StepId;
  stepNum: number;
  label: string;
}

const STEP_TABS: StepTabItem[] = [
  {
    id: 'get_campaign_info',
    stepNum: 1,
    label: '1. get_campaign_info',
  },
  {
    id: 'a2a_bigquery',
    stepNum: 2,
    label: '2. data_agent_toolset',
  },
  {
    id: 'deploy_bidding_policy',
    stepNum: 3,
    label: '3. deploy_bidding_policy',
  },
  {
    id: 'prompt',
    stepNum: 4,
    label: '4. bidding_policy_prompt.md',
  },
];

const STEP_HINTS: Record<StepId, { text: string; code: string }> = {
  get_campaign_info: {
    text: 'In agent.py above, add get_campaign_info to the tools list:',
    code: 'tools=[get_campaign_info],',
  },
  a2a_bigquery: {
    text: 'In agent.py above, add data_agent_toolset to the tools list:',
    code: 'tools=[get_campaign_info, data_agent_toolset],',
  },
  deploy_bidding_policy: {
    text: 'In agent.py above, add deploy_bidding_policy to the tools list:',
    code: 'tools=[get_campaign_info, data_agent_toolset, deploy_bidding_policy],',
  },
  prompt: {
    text: 'In agent.py above, update instruction="" in root_agent to:',
    code: 'instruction=PROMPT_PATH.read_text(encoding="utf-8"),',
  },
};

interface CodeExplanation {
  title: string;
  description: string;
}

const PROMPT_SPEC_SNIPPET = `# Bidding Agent Policy Objective

You are the Vibetube Bidding Agent.

## Optimization Objective
Your goal is to maximize total impressions won while managing spend across the flight:
- **Campaign Constraints:** Invoke \`get_campaign_info()\` to discover campaign constraints at runtime (\`total_budget\`, \`flight_duration_hours\`, and \`max_bid_ceiling\`).
- **Telemetry Discovery:** Use \`data_agent_toolset\` to explore historical auction telemetry and understand market clearing prices (\`p90\` or \`market_price\`) across dayparts.
- **Pacing & Spend Management:** Pace spend across the flight so the campaign does not exhaust its budget prematurely or leave substantial capital unspent.
- **Deterministic Safety Clamping:** Strictly clamp all bids between an absolute minimum floor ($0.50) and \`context.max_bid_ceiling\`.

## Tools & Capabilities
You have access to tools to gather campaign context, explore historical
telemetry, and deploy code:
- \`get_campaign_info()\`: Retrieves active campaign configuration parameters
  (total budget, flight duration in hours, and maximum bid ceiling).
- \`data_agent_toolset\`: Queries Google Cloud's BigQuery Data Engineering Agent
  (\`projects/vibeflix-sandbox/locations/global/dataAgents/vibetube-bq-agent\`)
  to explore historical auction telemetry, market prices, and win rates.
- \`deploy_bidding_policy(python_code, strategy_summary)\`: Deploys the
  synthesized Python bidding policy script to production.

Use these tools to discover campaign constraints, analyze market telemetry,
formulate an adaptive bidding strategy balancing spend and win rate, and deploy
the policy code via \`deploy_bidding_policy\`. Do not assume fixed values;
always inspect and adapt to runtime parameters in \`AuctionContext\`.

## Code Requirements for \`deploy_bidding_policy\`
The \`python_code\` passed to \`deploy_bidding_policy\` must be a complete, valid
Python script implementing \`def compute_bid(context: AuctionContext) -> float\`:

\`\`\`python
from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    # 1. Inspect live context attributes (daypart, market_price, budget_remaining, hours_remaining)
    # 2. Apply pacing multiplier and daypart bid shading
    # 3. Clamp bid to context.max_bid_ceiling
    ...
\`\`\``;

const PROMPT_SPEC_EXPLANATIONS: CodeExplanation[] = [
  {
    title: 'Economic Mission & Objectives',
    description: 'Directs Gemini to optimize total impressions won across the 24-hour flight while pacing budget expenditure evenly to avoid running out before primetime.',
  },
  {
    title: 'First-Price Auction Guidance',
    description: 'Explicitly instructs the agent to shade bids near competitor market prices rather than bidding fixed ceilings, mitigating the Overpayment Trap.',
  },
  {
    title: 'Autonomous Tooling Protocol',
    description: 'Guides the agent on how to call get_campaign_info() for boundaries, ask_data_agent() for BigQuery telemetry percentiles, and deploy_bidding_policy() to publish Python code.',
  },
  {
    title: 'Python Interface Contract',
    description: 'Strictly defines the expected compute_bid(context: AuctionContext) signature and documents all injected runtime attributes (p90, daypart, budget, hours).',
  },
];

interface ToolDetail {
  id: ToolId;
  boxLabel: string;
  targetLabel: string;
  themeColor: 'emerald' | 'cyan' | 'amber';
  targetSystem: string;
  toolCodeFilename: string;
  toolCodeSnippet: string;
  toolCodeExplanations: CodeExplanation[];
}

const TOOLS_CONFIG: Record<ToolId, ToolDetail> = {
  get_campaign_info: {
    id: 'get_campaign_info',
    boxLabel: 'get_campaign_info',
    targetLabel: 'Campaigns Table',
    themeColor: 'emerald',
    targetSystem: 'Vibetube Ad Server REST API (/campaign/config)',
    toolCodeFilename: 'lib/tools.py',
    toolCodeSnippet: `def get_campaign_info() -> CampaignInfo:
    """Retrieves active campaign configuration parameters from the ad server.

    Returns:
        CampaignInfo: Pydantic model containing campaign budget, duration,
                      and bid guardrails.
    """
    url = f"{settings.ad_server_url}/campaign/config"
    res = requests.get(url, timeout=5)
    res.raise_for_status()
    return CampaignInfo.model_validate(res.json())`,
    toolCodeExplanations: [
      {
        title: 'Ad Server REST Fetch',
        description: 'Queries the /campaign/config endpoint to read live parameters including the $2,500 total budget and 24-hour flight window.',
      },
      {
        title: 'Pydantic Model Validation',
        description: 'Validates JSON responses against strict CampaignInfo schema to prevent runtime attribute errors.',
      },
    ],
  },
  a2a_bigquery: {
    id: 'a2a_bigquery',
    boxLabel: 'data_agent_toolset',
    targetLabel: 'BigQuery Data Engineering Agent',
    themeColor: 'cyan',
    targetSystem: 'Google Cloud Gemini Data Analytics & BigQuery Warehouse',
    toolCodeFilename: 'lib/tools.py',
    toolCodeSnippet: `from google.adk.tools.data_agent.config import DataAgentToolConfig
from google.adk.tools.data_agent.credentials import DataAgentCredentialsConfig
from google.adk.tools.data_agent.data_agent_toolset import DataAgentToolset

# 1. Authenticate with Google Cloud Application Default Credentials (ADC)
credentials, _ = google.auth.default(
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)
cred_config = DataAgentCredentialsConfig(credentials=credentials)

# 2. Bind to Google Cloud BigQuery Data Engineering Agent endpoint
tool_config = DataAgentToolConfig(
    api_endpoint="https://geminidataanalytics.googleapis.com",
    location="global",
)

# 3. Instantiate native DataAgentToolset (equips ask_data_agent)
data_agent_toolset = DataAgentToolset(
    credentials_config=cred_config,
    data_agent_tool_config=tool_config,
)`,
    toolCodeExplanations: [
      {
        title: 'GCP ADC Authentication',
        description: 'Obtains secure Google Cloud OAuth2 tokens via Application Default Credentials (ADC).',
      },
      {
        title: 'Native DataAgentToolset',
        description: 'Binds to the Gemini Data Analytics service, equipping the native ask_data_agent tool for natural language analytics.',
      },
    ],
  },
  deploy_bidding_policy: {
    id: 'deploy_bidding_policy',
    boxLabel: 'deploy_bidding_policy',
    targetLabel: 'bidding_policy.py',
    themeColor: 'amber',
    targetSystem: 'Local Policy Repository & Ad Server Runtime',
    toolCodeFilename: 'lib/tools.py',
    toolCodeSnippet: `def deploy_bidding_policy(python_code: str, strategy_summary: str) -> str:
    # 1. Deterministic AST syntax & signature pre-flight self-eval
    validation = validate_script(cleaned_code)
    if not validation.get("valid"):
        return f"Deployment rejected ({validation['error_type']}): {validation['message']}"

    # 2. Dynamic execution smoke test with sample AuctionContext
    policy_func = load_policy_from_code(cleaned_code)
    test_bid = policy_func(dummy_context)

    # 3. Format and write atomically to disk
    cleaned_code = black.format_str(cleaned_code, mode=black.FileMode(line_length=88))
    OUTPUT_POLICY_PATH.write_text(cleaned_code, encoding="utf-8")
    return f"Successfully deployed bidding policy to {OUTPUT_POLICY_PATH.name}."`,
    toolCodeExplanations: [
      {
        title: 'Level 1: Pre-Flight Self-Evaluation',
        description: 'Performs deterministic AST syntax verification and a runtime smoke test with AuctionContext before saving, rejecting broken code back to the agent.',
      },
      {
        title: 'PEP 8 Auto-Formatting',
        description: 'Auto-formats synthesized Python code via Black and wraps lines for production consistency.',
      },
      {
        title: 'Atomic Disk Deployment',
        description: 'Writes the verified code atomically to agent_bidding_policy.py where the ad simulator dynamically hot-reloads it.',
      },
    ],
  },
};


const INITIAL_AGENT_CODE = `"""Vibetube Bidding Agent ADK Agent Module."""

from pathlib import Path

from google.adk.agents import LlmAgent

from lib.config import retry_config, settings
from lib.tools import data_agent_toolset, deploy_bidding_policy, get_campaign_info

PROMPT_PATH = Path(__file__).resolve().parent / "bidding_policy_prompt.md"

root_agent = LlmAgent(
    name="bidding_agent",
    model=settings.model_name,
    instruction="",
    tools=[],
    generate_content_config=retry_config,
)`;

const DEFAULT_FALLBACK_CODE = `from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    # Campaign-specific constant derived at deployment time for current campaign
    ideal_hourly_velocity = 104.16666666666667  # 2500.0 / 24.0

    # 1. Dynamic Budget Pacing Formulation
    safe_hours_remaining = max(0.5, context.hours_remaining)
    current_hourly_burn = context.budget_remaining / safe_hours_remaining
    pacing_factor = min(1.25, max(0.70, current_hourly_burn / ideal_hourly_velocity))

    # 2. Micro-Signals: Price Momentum & Closed-Loop Win-Rate Feedback
    micro_signals_adjustment = 0.0
    target_win_rate = 0.60
    win_rate_deviation = target_win_rate - context.win_rate
    micro_signals_adjustment += 0.25 * win_rate_deviation

    if context.p90_history and len(context.p90_history) >= 2:
        price_momentum = context.p90_history[-1] - context.p90_history[-2]
        micro_signals_adjustment += price_momentum * 0.1

    # 3. First-Price Bid Shading & Daypart Adaptation
    base_market_price = context.p90 if context.p90 is not None else 0.50

    if context.daypart == "primetime":
        computed_bid = (base_market_price * 1.05) + 0.05
    elif context.daypart == "late_night":
        computed_bid = 0.95
    elif context.daypart == "morning":
        computed_bid = base_market_price * 0.98
    elif context.daypart == "afternoon":
        computed_bid = base_market_price + 0.02
    elif context.daypart == "lunch":
        computed_bid = base_market_price
    else:
        computed_bid = base_market_price

    computed_bid = (computed_bid + micro_signals_adjustment) * pacing_factor
    return max(0.50, min(computed_bid, context.max_bid_ceiling))
`;

function checkToolRegistered(code: string, toolPattern: string): boolean {
  const toolsMatch = code.match(/tools\s*=\s*\[([\s\S]*?)\]/);
  const targetText = toolsMatch ? toolsMatch[1] : code;

  // Strip comments from lines so commented-out TODOs aren't treated as registered tools
  const uncommented = targetText
    .split('\n')
    .map(line => {
      const idx = line.indexOf('#');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');

  const regex = new RegExp(`\\b${toolPattern}\\b`);
  return regex.test(uncommented);
}

const DEFAULT_CAMPAIGN_INFO = {
  id: "camp-default",
  name: "BotBlend Go Campaign",
  total_budget: 2500.0,
  budget_remaining: 2500.0,
  max_bid_ceiling: 10.0,
  base_bid_cpm: 2.5,
  active_bid_cpm: 2.5,
  flight_duration_hours: 24.0,
};

const parseKeyValueString = (str: string): Record<string, any> | null => {
  if (!str || typeof str !== 'string' || !str.includes('=')) return null;
  const parsed: Record<string, any> = {};
  const matches = str.matchAll(/([a-zA-Z_]+)=('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|[^\s,]+)/g);
  for (const match of matches) {
    const k = match[1];
    let v: any = match[2].replace(/^['"]|['"]$/g, '');
    if (!isNaN(Number(v)) && v.trim() !== '') {
      v = Number(v);
    }
    parsed[k] = v;
  }
  return Object.keys(parsed).length > 0 ? parsed : null;
};

const formatCampaignJson = (info: any): string => {
  if (!info) return JSON.stringify(DEFAULT_CAMPAIGN_INFO, null, 2);

  let target = info;

  if (typeof target === 'string') {
    try {
      target = JSON.parse(target);
    } catch {
      const kv = parseKeyValueString(target);
      if (kv) return JSON.stringify(kv, null, 2);
      return target;
    }
  }

  if (target && typeof target === 'object') {
    if (target.campaign_info) {
      return formatCampaignJson(target.campaign_info);
    }
    if (target.result) {
      return formatCampaignJson(target.result);
    }
  }

  return JSON.stringify(target, null, 2);
};

const DEFAULT_BQ_PROMPT = `Analyze auction telemetry across dayparts in vibetube_telemetry.auction_events:
• Discover market clearing price distribution (P90 competitor bids)
• Calculate empirical win rates and volume across 54M auctions
• Measure price volatility across dayparts to guide dynamic bid shading`;

const DEFAULT_BQ_SQL = `SELECT daypart,
       COUNT(*) AS total_auctions,
       ROUND(AVG(win) * 100, 2) AS win_rate_percentage,
       ROUND(AVG(competitor_highest_bid_cpm), 4) AS avg_clearing_price,
       ROUND(APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(50)], 4) AS median_clearing_price,
       ROUND(APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(90)], 4) AS p90_clearing_price,
       ROUND(STDDEV_SAMP(competitor_highest_bid_cpm), 4) AS clearing_price_volatility,
       ROUND(MIN(competitor_highest_bid_cpm), 4) AS min_clearing_price,
       ROUND(MAX(competitor_highest_bid_cpm), 4) AS max_clearing_price
FROM \`vibeflix-sandbox.vibetube_telemetry.auction_events\`
GROUP BY daypart
ORDER BY total_auctions DESC;`;

const DEFAULT_BQ_FINDINGS = `Daypart Analysis & Strategy Insights:
• Win Rate Thresholds: 100% win rate during late_night (avg clearing price $0.75) and 93.7% during morning (avg clearing price $2.25)
• Outbid Dayparts: 0% win rate during lunch ($4.08 avg), afternoon ($8.28 avg), and primetime ($9.28 avg)
• Price Volatility: primetime exhibits highest clearing prices (P90 of $9.71) and peak volatility (σ = 0.32)`;

const formatConversationQuery = (queries: string[]): string => {
  if (!queries || queries.length === 0) {
    return DEFAULT_BQ_PROMPT;
  }
  return queries
    .map((q) => {
      const trimmed = q.trim();
      if (!trimmed.includes('\n')) {
        const sentences = trimmed.split(/(?<=\.)\s+/).filter(Boolean);
        if (sentences.length > 1) {
          return sentences.join('\n');
        }
      }
      return trimmed;
    })
    .join('\n\n');
};

export default function AIDataEngineer({ navigate, activeLab }: { navigate: (v: string) => void; activeLab?: string }) {
  const [agentCode, setAgentCode] = useState<string>(INITIAL_AGENT_CODE);
  const [activeStepTab, setActiveStepTab] = useState<StepId>('get_campaign_info');

  // Live execution states
  type StepStatus = 'idle' | 'running' | 'done';
  const [stepStatus, setStepStatus] = useState<Record<number, StepStatus>>({
    1: 'idle',
    2: 'idle',
    3: 'idle',
    4: 'idle',
  });
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [completed, setCompleted] = useState<boolean>(false);
  const [executionSeconds, setExecutionSeconds] = useState<number>(0);
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryNotice, setRetryNotice] = useState<string | null>(null);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);
  const [liveReasoning, setLiveReasoning] = useState<string>('');
  const [liveQueries, setLiveQueries] = useState<string[]>([]);
  const [liveBqSql, setLiveBqSql] = useState<string>('');
  const [liveBqFindings, setLiveBqFindings] = useState<string>('');
  const [liveCampaignInfo, setLiveCampaignInfo] = useState<any>(null);
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [copiedHint, setCopiedHint] = useState<string | null>(null);

  const toggleHint = (stepId: string) => {
    setRevealedHints(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const handleCopyHint = (stepId: StepId) => {
    const codeToCopy = STEP_HINTS[stepId].code;
    navigator.clipboard.writeText(codeToCopy);
    setCopiedHint(stepId);
    setTimeout(() => setCopiedHint(null), 2000);
  };

  const executionSectionRef = useRef<HTMLDivElement>(null);

  // Dynamic Theme Detection
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

  // Check instruction binding
  const isInstructionBound = agentCode.includes('PROMPT_PATH.read_text(') || agentCode.includes('SPEC_PATH.read_text(');

  // Derive equipped status dynamically from agentCode
  const hasCampaignInfo = checkToolRegistered(agentCode, 'get_campaign_info');
  const hasDataAgent = checkToolRegistered(agentCode, 'data_agent_toolset') || checkToolRegistered(agentCode, 'DataAgentToolset');
  const hasDeploy = checkToolRegistered(agentCode, 'deploy_bidding_policy');

  const equipped: Record<ToolId, boolean> = {
    get_campaign_info: hasCampaignInfo,
    a2a_bigquery: hasDataAgent,
    deploy_bidding_policy: hasDeploy,
  };

  const equippedCount = [hasCampaignInfo, hasDataAgent, hasDeploy].filter(Boolean).length;
  const allEquipped = equippedCount === 3 && isInstructionBound;

  // Step locking logic: each step unlocks as the prior required tool is equipped
  const isTabUnlocked = (tabId: StepId): boolean => {
    if (tabId === 'get_campaign_info') return true;
    if (tabId === 'a2a_bigquery') return hasCampaignInfo;
    if (tabId === 'deploy_bidding_policy') return hasCampaignInfo && hasDataAgent;
    if (tabId === 'prompt') return hasCampaignInfo && hasDataAgent && hasDeploy;
    return false;
  };

  // Timer while executing
  useEffect(() => {
    let timer: any;
    if (isRunning) {
      setExecutionSeconds(0);
      timer = setInterval(() => {
        setExecutionSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isRunning]);

  // Scroll to execution section if routed to agent_execution
  useEffect(() => {
    if (activeLab === 'agent_execution' && executionSectionRef.current) {
      executionSectionRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activeLab]);

  const CLI_COMMAND = `adk run . "Retrieve active campaign info, analyze auction telemetry across dayparts, and deploy compute_bid policy"`;

  const handleCopyCli = async () => {
    await navigator.clipboard.writeText(CLI_COMMAND);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleRunAgent = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setErrorMessage(null);
    setRetryNotice(null);
    setCompleted(false);
    setLiveReasoning('');
    setLiveQueries([]);
    setLiveBqSql('');
    setLiveBqFindings('');
    setLiveCampaignInfo(null);
    setStepStatus({
      1: 'running',
      2: 'idle',
      3: 'idle',
      4: 'idle',
    });

    try {
      const res = await fetch('/agent/run-cycle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code: agentCode }),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        setErrorMessage(`Agent execution error (${res.status}): ${errText || 'Process failed'}`);
        return;
      }

      if (!res.body) {
        throw new Error('ReadableStream not supported');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      const processEvent = (event: any) => {
        if (!event || typeof event !== 'object') return;

        if (event.type === 'init') {
          setStepStatus((prev) => ({ ...prev, 1: 'running' as StepStatus }));
        } else if (event.type === 'retry') {
          const delay = event.retry_delay || 15;
          setRetryNotice(`Rate limit encountered. Retrying cycle (attempt ${event.attempt}/${event.max_attempts}) in ${delay}s...`);
        } else if (event.type === 'step_start') {
          const s = Number(event.step);
          setStepStatus((prev) => {
            const next = { ...prev, [s]: 'running' as StepStatus };
            for (let i = 1; i < s; i++) {
              next[i] = 'done' as StepStatus;
            }
            return next;
          });
          if (event.query && typeof event.query === 'string' && event.query.trim().length > 0) {
            setLiveQueries((prev) => {
              if (!prev.includes(event.query)) return [...prev, event.query];
              return prev;
            });
          }
        } else if (event.type === 'step_done') {
          const s = Number(event.step);
          setStepStatus((prev) => {
            const next = { ...prev, [s]: 'done' as StepStatus };
            if (s < 4 && next[s + 1] === 'idle') {
              next[s + 1] = 'running' as StepStatus;
            }
            return next;
          });
          if (s === 1 && (event.campaign_info || event.data)) {
            setLiveCampaignInfo(event.campaign_info || event.data);
          }
          if (s === 2) {
            if (event.generated_sql) {
              setLiveBqSql(event.generated_sql);
            }
            if (event.findings) {
              setLiveBqFindings(event.findings);
            }
          }
        } else if (event.type === 'reasoning_chunk') {
          setStepStatus((prev) => {
            if (prev[3] !== 'running') {
              return { ...prev, 1: 'done', 2: 'done', 3: 'running' as StepStatus };
            }
            return prev;
          });
          if (event.chunk) {
            setLiveReasoning((prev) => prev + event.chunk);
          }
        } else if (event.type === 'complete' || (event.status === 'success' && event.script)) {
          setRetryNotice(null);
          setStepStatus({ 1: 'done', 2: 'done', 3: 'done', 4: 'done' });
          const script = event.script && event.script.trim().length > 0 ? event.script : DEFAULT_FALLBACK_CODE;
          setGeneratedCode(script);
          if (event.campaign_info) {
            setLiveCampaignInfo(event.campaign_info);
          }
          if (event.reasoning) {
            setLiveReasoning(event.reasoning);
          }
          if (event.sql_queries && Array.isArray(event.sql_queries) && event.sql_queries.length > 0) {
            const sqls = event.sql_queries.filter((q: string) => /^\s*SELECT/i.test(q));
            const naturalQueries = event.sql_queries.filter((q: string) => !/^\s*SELECT/i.test(q));
            if (sqls.length > 0) {
              setLiveBqSql(sqls[sqls.length - 1]);
            }
            if (naturalQueries.length > 0) {
              setLiveQueries(naturalQueries);
            }
          }
          if (event.findings) {
            setLiveBqFindings(event.findings);
          }
          setCompleted(true);
        } else if (event.type === 'error' || event.status === 'error') {
          setRetryNotice(null);
          setErrorMessage(event.error_message || event.message || 'Agent execution failed');
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const event = JSON.parse(trimmed);
            processEvent(event);
          } catch (e) {
            console.warn('Failed to parse NDJSON line:', trimmed, e);
          }
        }
      }

      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim());
          processEvent(event);
        } catch (e) {
          // ignore
        }
      }
    } catch (err: any) {
      console.error('Agent execution exception:', err);
      setErrorMessage(err.message || 'Network error executing agent cycle');
    } finally {
      setIsRunning(false);
    }
  };

  const codeTagClass = isLight
    ? 'bg-slate-200/80 text-slate-900 border border-slate-300/60'
    : 'bg-overlay text-fg border border-hairline';


  // MAIN CONSOLIDATED VIEW: Architecture Canvas + agent.py + Execution
  // --------------------------------------------------------------------------
  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* 1. System Architecture Overview (Visual Diagram & Product Logos) */}
      <div className="rounded-3xl overflow-hidden border border-hairline bg-[#FDFBF7] dark:bg-slate-950/40 p-6 md:p-8 shadow-xl flex flex-col items-center justify-center">
        <img
          src="/adk-agent-architecture.png"
          alt="Agentic Data Engineer Multi-System Architecture"
          className="w-full max-w-4xl max-h-[460px] object-contain mx-auto rounded-xl drop-shadow-md"
        />
        <p className="text-sm text-slate-600 dark:text-fg-muted font-sans mt-3 text-center max-w-2xl leading-relaxed">
          <strong>Closed-Loop Telemetry to Actuator Architecture:</strong> The ADK 2.0 Agent retrieves campaign boundaries from the Vibetube Ad Server, collaborates with the BigQuery Data Engineering Agent over historical telemetry, and deploys verified bidding logic into <code className={`font-mono text-xs px-1 py-0.5 rounded ${codeTagClass}`}>bidding_policy.py</code>.
        </p>
      </div>

      {/* Interactive agent.py Code Assembly (Editable, Single Instance Above Stepper) */}
      <div id="agent-code-editor" className="rounded-3xl overflow-hidden border border-hairline bg-card shadow-xl">
        <PythonCodeHighlight
          code={agentCode}
          filename="agentic_data_engineer/agent.py"
          editable={true}
          showCopy={false}
          onChange={setAgentCode}
          onReset={() => setAgentCode(INITIAL_AGENT_CODE)}
          isModified={agentCode !== INITIAL_AGENT_CODE}
          className="max-h-[640px]"
        />
      </div>

      {/* Unified 4-Step Assembly Stepper (3 Tools + Prompt Spec) */}
      <div className="rounded-3xl border border-hairline bg-card shadow-xl overflow-hidden p-6 md:p-8 space-y-6">
        {/* Stepper Tabs Bar with Sequential Step Locking */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {STEP_TABS.map((tab) => {
            const isSelected = activeStepTab === tab.id;
            const isDone = tab.id === 'prompt' ? isInstructionBound : equipped[tab.id as ToolId];
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
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                    !unlocked
                      ? 'bg-overlay text-fg-muted/60'
                      : isDone
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : isSelected
                      ? 'bg-purple-500 text-white'
                      : 'bg-overlay text-fg-muted'
                  }`}>
                    {!unlocked ? (
                      <Lock size={11} />
                    ) : isDone ? (
                      <Check size={12} />
                    ) : tab.id === 'prompt' ? (
                      <FileText size={12} />
                    ) : (
                      <Code2 size={12} />
                    )}
                  </div>
                  <span className={`text-xs font-bold font-mono truncate ${
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
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    ✓ Done
                  </span>
                ) : !unlocked ? (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 bg-overlay text-fg-muted/60 border-hairline">
                    Locked
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Active Tab Body: Steps 1-3 Tools */}
        {activeStepTab !== 'prompt' && (() => {
          const tool = TOOLS_CONFIG[activeStepTab];
          const isCurrentEquipped = equipped[activeStepTab];
          const nextTabMap: Record<ToolId, StepId> = {
            get_campaign_info: 'a2a_bigquery',
            a2a_bigquery: 'deploy_bidding_policy',
            deploy_bidding_policy: 'prompt',
          };
          const nextTab = nextTabMap[activeStepTab];

          return (
            <div className="space-y-4 animate-rise">
              {/* Full-width code block */}
              <PythonCodeHighlight
                code={tool.toolCodeSnippet}
                filename={tool.toolCodeFilename}
                editable={false}
                showCopy={false}
                className="max-h-[640px]"
              />

              {/* Help bubble components underneath code block */}
              <div className={`grid grid-cols-1 gap-3.5 pt-2 ${
                tool.toolCodeExplanations.length === 2
                  ? 'md:grid-cols-2'
                  : tool.toolCodeExplanations.length === 3
                  ? 'md:grid-cols-3'
                  : 'md:grid-cols-2 lg:grid-cols-4'
              }`}>
                {tool.toolCodeExplanations.map((item, idx) => (
                  <div key={idx} className="p-4 bg-card rounded-2xl border border-hairline shadow-sm space-y-1.5">
                    <h5 className="text-sm font-semibold text-fg flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        tool.themeColor === 'emerald'
                          ? 'bg-emerald-500'
                          : tool.themeColor === 'cyan'
                          ? 'bg-vibe-cyan'
                          : 'bg-amber-500'
                      }`} />
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
                    isCurrentEquipped
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                      : isLight
                      ? 'bg-slate-100 border-slate-200 text-slate-500'
                      : 'bg-overlay border-hairline text-fg-muted'
                  }`}>
                    {isCurrentEquipped ? <Check size={16} /> : <Code2 size={16} />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-fg font-sans">
                      {isCurrentEquipped ? (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-mono">
                          <code className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">{tool.boxLabel}</code> is equipped in the tools array above.
                        </span>
                      ) : (
                        <span>
                          Equip <code className={`font-mono text-xs px-1.5 py-0.5 rounded ${codeTagClass}`}>{tool.boxLabel}</code> in the <code className="font-mono text-fg font-bold">tools=[...]</code> array in the code block above.
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!isCurrentEquipped}
                  onClick={() => isCurrentEquipped && setActiveStepTab(nextTab)}
                  className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 ${
                    isCurrentEquipped
                      ? 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black shadow-md cursor-pointer hover:shadow-vibe-cyan/20'
                      : isLight
                      ? 'bg-slate-100 text-slate-400 border border-slate-200 opacity-60 cursor-not-allowed'
                      : 'bg-overlay text-fg-muted border border-hairline opacity-40 cursor-not-allowed'
                  }`}
                  title={isCurrentEquipped ? `Advance to next step` : `Equip ${tool.boxLabel} in the tools array above to unlock`}
                >
                  <span>|&gt; Next</span>
                </button>
              </div>

              {/* Full-width Reveal Hint in a new div below the instruction */}
              {!isCurrentEquipped && (
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
                        <button
                          type="button"
                          onClick={() => handleCopyHint(activeStepTab)}
                          className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                            copiedHint === activeStepTab
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                              : isLight
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                              : 'bg-overlay hover:bg-hairline text-fg-muted hover:text-fg border-hairline'
                          }`}
                          title="Copy hint code to clipboard"
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
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Active Tab Body: Step 4 Prompt */}
        {activeStepTab === 'prompt' && (
          <div className="space-y-4 animate-rise">
            {/* Full-width code block */}
            <PythonCodeHighlight
              code={PROMPT_SPEC_SNIPPET}
              filename="bidding_policy_prompt.md"
              editable={false}
              showCopy={false}
              className="max-h-[640px]"
            />

            {/* Help bubble components underneath code block */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 pt-2">
              {PROMPT_SPEC_EXPLANATIONS.map((item, idx) => (
                <div key={idx} className="p-4 bg-card rounded-2xl border border-hairline shadow-sm space-y-1.5">
                  <h5 className="text-sm font-semibold text-fg flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                    {item.title}
                  </h5>
                  <p className="text-sm text-fg-muted leading-relaxed font-sans">{item.description}</p>
                </div>
              ))}
            </div>

            {/* Action Instruction for Step 4 Prompt Binding */}
            <div className="pt-4 border-t border-hairline flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                isInstructionBound
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : isLight
                  ? 'bg-slate-100 border-slate-200 text-slate-500'
                  : 'bg-overlay border-hairline text-fg-muted'
              }`}>
                {isInstructionBound ? <Check size={16} /> : <FileText size={16} />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg font-sans">
                  {isInstructionBound ? (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-mono">
                      Prompt specification bound to <code className="font-bold">instruction=PROMPT_PATH.read_text(encoding="utf-8")</code> above.
                    </span>
                  ) : (
                    <span>
                      Equip the prompt specification by setting <code className={`font-mono text-xs px-1.5 py-0.5 rounded ${codeTagClass}`}>instruction=PROMPT_PATH.read_text(encoding="utf-8")</code> in <code className="font-mono text-fg font-bold">root_agent</code> above.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Full-width Reveal Hint in a new div below the instruction */}
            {!isInstructionBound && (
              <div className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                isLight
                  ? 'bg-amber-50/70 border-amber-200/90 text-slate-900 shadow-xs'
                  : 'bg-overlay/30 border-hairline text-fg'
              }`}>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleHint('prompt')}
                    className="text-sm font-mono font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Lightbulb size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{revealedHints['prompt'] ? 'Hide Hint' : 'Reveal Hint'}</span>
                  </button>
                </div>

                {revealedHints['prompt'] && (
                  <div className={`pt-3 border-t space-y-2.5 animate-rise ${isLight ? 'border-amber-200/80' : 'border-hairline'}`}>
                    <p className={`text-sm font-sans leading-relaxed ${isLight ? 'text-slate-800 font-medium' : 'text-fg'}`}>
                      {STEP_HINTS['prompt'].text}
                    </p>
                    <div className={`p-2.5 sm:p-3 rounded-xl border font-mono text-sm flex items-center justify-between gap-3 ${
                      isLight
                        ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
                        : 'bg-slate-950 border-slate-800 text-amber-300 shadow-inner'
                    }`}>
                      <code className="overflow-x-auto select-all py-0.5">{STEP_HINTS['prompt'].code}</code>
                      <button
                        type="button"
                        onClick={() => handleCopyHint('prompt')}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                          copiedHint === 'prompt'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                            : isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            : 'bg-overlay hover:bg-hairline text-fg-muted hover:text-fg border-hairline'
                        }`}
                        title="Copy hint code to clipboard"
                      >
                        {copiedHint === 'prompt' ? (
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
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Live Agent Execution & Policy Deployment */}
      <div ref={executionSectionRef} className="space-y-6 pt-4 border-t border-hairline">
        {!allEquipped ? (
          /* Locked State Banner */
          <div className="p-8 rounded-3xl border-2 border-dashed border-hairline bg-card/40 opacity-80 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-overlay border border-hairline flex items-center justify-center text-fg-muted">
              <Lock size={22} />
            </div>
            <h4 className="text-base font-bold text-fg">
              Live Agent Execution &amp; Deployment (Locked)
            </h4>
            <p className="text-sm text-fg-muted max-w-lg font-sans">
              Bind the system prompt specification and register all 3 enterprise tools in <code className="text-fg font-semibold">tools=[...]</code> above to unlock live agent execution.
            </p>
            <div className="text-sm font-mono text-amber-600 dark:text-amber-400 font-bold">
              Prompt: {isInstructionBound ? '✓ Bound' : 'Pending'} · Tools: {equippedCount}/3 Registered
            </div>
          </div>
        ) : (
          /* Unlocked Execution Panel */
          <div className="space-y-6 animate-rise">
            {/* Cloud Shell CLI Execution Box (User Requested) */}
            <div className="p-5 rounded-2xl border border-slate-300 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal size={16} className="text-cyan-700 dark:text-vibe-cyan" />
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Cloud Shell CLI Execution</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCli}
                    className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white rounded-lg border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
                  >
                    {copiedCli ? (
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
                {CLI_COMMAND}
              </div>

              <div className="text-sm text-slate-600 dark:text-slate-400 font-sans">
                Kick off this execution in Cloud Shell, or trigger it directly in the workbench using the button below.
              </div>
            </div>

            {/* Retry Notice Banner */}
            {retryNotice && (
              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-2.5 text-amber-600 dark:text-amber-400 text-sm font-mono shadow-sm animate-pulse">
                <Clock size={16} className="shrink-0" />
                <span>{retryNotice}</span>
              </div>
            )}

            {/* Error Message (No Silent Fallback) */}
            {errorMessage && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between gap-3 text-red-600 dark:text-red-400 text-sm font-mono shadow-sm">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle size={16} className="shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  onClick={handleRunAgent}
                  className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-300 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  Retry Run
                </button>
              </div>
            )}

            {/* 4-Step Agent Execution & Trace Card */}
            <div className="p-6 bg-card rounded-3xl border border-hairline shadow-2xl space-y-6">
              {/* Header & Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-hairline">
                <div>
                  <h3 className="text-lg font-bold text-fg flex items-center gap-2">
                    <Bot size={20} className="text-vibe-cyan" />
                    <span>Execute Bidding Policy Agent</span>
                  </h3>
                  <p className="text-sm text-fg-muted mt-1 font-sans">
                    Runs the multi-agent ADK 2.0 cycle: queries BigQuery Data Agent across 3 months of telemetry and synthesizes Python policy.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {isRunning ? (
                    <div className="px-5 py-2.5 bg-vibe-cyan/15 border border-vibe-cyan/40 text-cyan-800 dark:text-vibe-cyan rounded-xl text-sm font-mono font-bold flex items-center gap-2 shadow-sm animate-pulse">
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Executing Live Agent... ({executionSeconds}s)</span>
                    </div>
                  ) : completed ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRunAgent}
                        className="px-4 py-2.5 bg-overlay hover:bg-hairline text-fg text-sm font-semibold rounded-xl border border-hairline transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                      >
                        <RefreshCw size={14} />
                        <span>Re-Execute Agent</span>
                      </button>
                      <button
                        onClick={() => navigate('adk_eval')}
                        className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                      >
                        <span>Proceed to ADK Eval</span>
                        <ArrowRight size={15} />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleRunAgent}
                      className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <Play size={15} className="fill-black" />
                      <span>Execute Bidding Policy Agent</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 4 Steps */}
              <div className="space-y-4 font-mono text-xs">
                {/* Step 1: get_campaign_info */}
                <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
                  stepStatus[1] === 'running'
                    ? 'bg-vibe-cyan/10 border-vibe-cyan text-fg shadow-md step-active-cyan ring-1 ring-vibe-cyan/40'
                    : stepStatus[1] === 'done' || completed
                    ? 'bg-card border-emerald-500/40 text-fg shadow-sm'
                    : 'bg-card/40 border-dashed border-hairline opacity-60 text-fg-muted'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                      stepStatus[1] === 'running'
                        ? 'bg-vibe-cyan/20 border-vibe-cyan text-cyan-800 dark:text-vibe-cyan'
                        : stepStatus[1] === 'done' || completed
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                        : 'bg-overlay border-hairline text-fg-muted'
                    }`}>
                      {stepStatus[1] === 'running' ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : stepStatus[1] === 'done' || completed ? (
                        <Check size={16} />
                      ) : (
                        <Database size={16} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-base flex items-center gap-1.5 ${
                          stepStatus[1] === 'running'
                            ? 'font-bold text-cyan-800 dark:text-vibe-cyan'
                            : stepStatus[1] === 'done' || completed
                            ? 'font-bold text-emerald-700 dark:text-emerald-400'
                            : 'font-bold text-fg-muted'
                        }`}>
                          1. <code className={`font-mono px-1.5 py-0.5 rounded text-xs ${codeTagClass}`}>get_campaign_info</code> — Ad Server State Reader
                        </span>
                        <span className="text-xs font-mono font-medium text-fg-muted">REST Endpoint</span>
                      </div>
                      <p className="text-fg-muted text-sm font-sans leading-relaxed">
                        {stepStatus[1] === 'running' ? (
                          <span className="text-cyan-800 dark:text-vibe-cyan font-mono flex items-center gap-2">
                            <RefreshCw size={13} className="animate-spin" /> Querying ad server REST endpoint (<code className="px-1 py-0.5 rounded bg-vibe-cyan/20">/campaign/config</code>) for live budget &amp; bid ceiling...
                          </span>
                        ) : (
                          <span>Queries ad server for live campaign parameters (budget, flight duration, bid ceilings).</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {(stepStatus[1] === 'done' || completed) && (
                    <div className="pl-12 pt-1">
                      <div className={`p-3.5 rounded-xl border font-mono space-y-2 ${isLight ? 'bg-slate-100/90 border-slate-200 text-slate-800 shadow-sm' : 'bg-overlay border-hairline text-fg-muted'}`}>
                        <div className={`flex items-center justify-between text-xs uppercase tracking-wider font-bold border-b pb-1.5 ${isLight ? 'border-slate-200 text-slate-600' : 'border-hairline/60 text-fg-muted'}`}>
                          <span className={`flex items-center gap-1.5 font-bold ${isLight ? 'text-cyan-700' : 'text-cyan-700 dark:text-vibe-cyan'}`}>
                            <Database size={13} /> Returned JSON Payload
                          </span>
                          <span className={`${isLight ? 'text-slate-500' : 'text-fg-muted'}`}>GET /campaign/config · HTTP 200 OK</span>
                        </div>
                        <pre className={`leading-relaxed whitespace-pre-wrap break-words overflow-x-auto text-xs md:text-sm font-mono ${isLight ? 'text-slate-900 font-medium' : 'text-fg-muted'}`}>
                          {formatCampaignJson(liveCampaignInfo)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 2: BigQuery Data Agent Tool Call */}
                <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
                  stepStatus[2] === 'running'
                    ? 'bg-vibe-cyan/10 border-vibe-cyan text-fg shadow-md step-active-cyan ring-1 ring-vibe-cyan/40'
                    : stepStatus[2] === 'done' || completed
                    ? 'bg-card border-emerald-500/40 text-fg shadow-sm'
                    : 'bg-card/40 border-dashed border-hairline opacity-60 text-fg-muted'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                      stepStatus[2] === 'running'
                        ? 'bg-vibe-cyan/20 border-vibe-cyan text-cyan-800 dark:text-vibe-cyan'
                        : stepStatus[2] === 'done' || completed
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                        : 'bg-overlay border-hairline text-fg-muted'
                    }`}>
                      {stepStatus[2] === 'running' ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : stepStatus[2] === 'done' || completed ? (
                        <Check size={16} />
                      ) : (
                        <Bot size={16} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-base flex items-center gap-1.5 ${
                          stepStatus[2] === 'running'
                            ? 'font-bold text-cyan-800 dark:text-vibe-cyan'
                            : stepStatus[2] === 'done' || completed
                            ? 'font-bold text-emerald-700 dark:text-emerald-400'
                            : 'font-bold text-cyan-700 dark:text-vibe-cyan'
                        }`}>
                          2. <code className={`font-mono px-1.5 py-0.5 rounded text-xs ${codeTagClass}`}>data_agent_toolset</code> — BigQuery Data Engineering Agent
                        </span>
                      </div>
                      <p className="text-fg-muted text-sm font-sans leading-relaxed">
                        {stepStatus[2] === 'running' ? (
                          <span className="text-cyan-800 dark:text-vibe-cyan font-mono flex items-center gap-2">
                            <RefreshCw size={13} className="animate-spin" /> BigQuery Data Agent executing natural language telemetry queries across 54M rows...
                          </span>
                        ) : (
                          <span>Dispatched natural language analytical intent to BigQuery Data Engineering Agent to analyze 3-month auction telemetry.</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {((stepStatus[2] === 'running' && (liveQueries.length > 0 || liveBqSql)) || stepStatus[2] === 'done' || completed) && (
                    <div className="pl-12 space-y-3 pt-1">
                      <div className={`p-3.5 rounded-xl border font-mono space-y-3 ${isLight ? 'bg-slate-100/90 border-slate-200 text-slate-800 shadow-sm' : 'bg-overlay border-hairline text-fg-muted'}`}>
                        <div className={`flex items-center justify-between text-xs uppercase tracking-wider font-bold border-b pb-1.5 ${isLight ? 'border-slate-200 text-slate-600' : 'border-hairline/60 text-fg-muted'}`}>
                          <span className={`flex items-center gap-1.5 font-bold ${isLight ? 'text-cyan-700' : 'text-cyan-700 dark:text-vibe-cyan'}`}>
                            <MessageSquare size={13} /> Conversation with BigQuery Data Engineering Agent
                          </span>
                          <span className={`${isLight ? 'text-slate-500' : 'text-fg-muted'}`}>vibetube_telemetry.auction_events · 54M rows</span>
                        </div>

                        {/* Turn 1: Bidding Agent Intent */}
                        <div className="space-y-1.5">
                          <div className={`flex items-center gap-1.5 text-xs font-bold ${isLight ? 'text-cyan-800' : 'text-cyan-700 dark:text-vibe-cyan'}`}>
                            <Bot size={13} />
                            <span>Bidding Agent (Prompt / Analytical Intent):</span>
                          </div>
                          <div className={`p-3 rounded-lg text-xs leading-relaxed font-mono whitespace-pre-wrap break-words ${isLight ? 'bg-white/90 border border-slate-200 text-slate-800' : 'bg-card/70 border border-hairline/60 text-fg'}`}>
                            {formatConversationQuery(liveQueries)}
                          </div>
                        </div>

                        {/* Turn 2: Synthesized BigQuery SQL */}
                        <div className="space-y-1.5">
                          <div className={`flex items-center gap-1.5 text-xs font-bold ${isLight ? 'text-emerald-800' : 'text-emerald-400'}`}>
                            <Database size={13} />
                            <span>BigQuery Data Engineering Agent (Synthesized SQL):</span>
                          </div>
                          <pre className={`p-3 rounded-lg leading-relaxed whitespace-pre-wrap break-words overflow-x-auto text-xs font-mono ${isLight ? 'bg-white/90 border border-slate-200 text-slate-900 font-medium' : 'bg-card/70 border border-hairline/60 text-fg-muted'}`}>
                            {liveBqSql || DEFAULT_BQ_SQL}
                          </pre>
                        </div>

                        {/* Turn 3: Telemetry Findings */}
                        {(liveBqFindings || stepStatus[2] === 'done' || completed) && (
                          <div className="space-y-1.5">
                            <div className={`flex items-center gap-1.5 text-xs font-bold ${isLight ? 'text-purple-800' : 'text-purple-400'}`}>
                              <Check size={13} />
                              <span>BigQuery Data Engineering Agent (Telemetry Findings):</span>
                            </div>
                            <div className={`p-3 rounded-lg text-xs leading-relaxed font-mono whitespace-pre-wrap break-words ${isLight ? 'bg-white/90 border border-slate-200 text-slate-800' : 'bg-card/70 border border-hairline/60 text-fg'}`}>
                              {liveBqFindings || DEFAULT_BQ_FINDINGS}
                            </div>
                          </div>
                        )}
                      </div>

                      {(stepStatus[2] === 'done' || completed) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                          <div className={`p-3.5 rounded-xl border shadow-sm space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-card border-hairline'}`}>
                            <span className="text-xs font-mono text-cyan-700 dark:text-vibe-cyan uppercase font-bold block">1. Flight Scale</span>
                            <div className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-fg'}`}>54,000,000 Auctions</div>
                          </div>
                          <div className={`p-3.5 rounded-xl border shadow-sm space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-card border-hairline'}`}>
                            <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 uppercase font-bold block">2. Price Spread</span>
                            <div className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-fg'}`}>$0.85 → $9.71 P90</div>
                          </div>
                          <div className={`p-3.5 rounded-xl border shadow-sm space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-card border-hairline'}`}>
                            <span className="text-xs font-mono text-purple-700 dark:text-purple-400 uppercase font-bold block">3. Momentum Gradient</span>
                            <div className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-fg'}`}>p90_history tracking</div>
                          </div>
                          <div className={`p-3.5 rounded-xl border shadow-sm space-y-1 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-card border-hairline'}`}>
                            <span className="text-xs font-mono text-amber-700 dark:text-amber-400 uppercase font-bold block">4. Win-Rate Elasticity</span>
                            <div className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-fg'}`}>Closed-Loop Feedback</div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Step 3: Gemini Mathematical Policy Synthesis */}
                <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
                  stepStatus[3] === 'running'
                    ? 'bg-purple-500/10 border-purple-500 text-fg shadow-md step-active-purple ring-1 ring-purple-500/40'
                    : stepStatus[3] === 'done' || completed
                    ? 'bg-card border-emerald-500/40 text-fg shadow-sm'
                    : 'bg-card/40 border-dashed border-hairline opacity-60 text-fg-muted'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                      stepStatus[3] === 'running'
                        ? 'bg-purple-500/20 border-purple-500 text-purple-700 dark:text-purple-300'
                        : stepStatus[3] === 'done' || completed
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                        : 'bg-overlay border-hairline text-fg-muted'
                    }`}>
                      {stepStatus[3] === 'running' ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : stepStatus[3] === 'done' || completed ? (
                        <Check size={16} />
                      ) : (
                        <Cpu size={16} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-base ${
                          stepStatus[3] === 'running'
                            ? 'font-bold text-purple-700 dark:text-purple-300'
                            : stepStatus[3] === 'done' || completed
                            ? 'font-bold text-emerald-700 dark:text-emerald-400'
                            : 'font-bold text-purple-600 dark:text-purple-400'
                        }`}>
                          3. Gemini Reasoning Engine — Mathematical Policy Synthesis
                        </span>
                        <span className="text-xs font-mono font-medium text-fg-muted">Optimization Logic</span>
                      </div>
                      <p className="text-fg-muted text-sm font-sans leading-relaxed">
                        {stepStatus[3] === 'running' ? (
                          <span className="text-purple-700 dark:text-purple-400 font-mono flex items-center gap-2">
                            <Cpu size={14} className="animate-pulse" /> Gemini reasoning engine formulating mathematical bidding rules in real-time...
                          </span>
                        ) : (
                          <span>Synthesized pacing velocity, daypart bid shading, and real-time micro-signals.</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {stepStatus[3] === 'running' && liveReasoning && (
                    <div className="pl-12 pt-1">
                      <div className={`p-3.5 rounded-xl border font-mono text-xs max-h-36 overflow-y-auto leading-relaxed whitespace-pre-line ${
                        isLight ? 'bg-slate-50 border-slate-200 text-slate-800' : 'bg-overlay border-hairline text-fg'
                      }`}>
                        {liveReasoning}
                      </div>
                    </div>
                  )}

                  {(stepStatus[3] === 'done' || completed) && (
                    <div className="pl-12 pt-1">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        <div className={`p-3.5 rounded-xl border shadow-sm space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-card border-hairline'}`}>
                          <span className="text-xs font-mono text-purple-700 dark:text-purple-400 uppercase font-bold block">1. Dynamic Pacing</span>
                          <div className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-fg'}`}>Burn Rate Velocity</div>
                          <p className={`text-xs font-sans leading-relaxed ${isLight ? 'text-slate-600' : 'text-fg-muted'}`}>
                            Balances spend speed against remaining flight time so the budget lasts without under-spending.
                          </p>
                        </div>
                        <div className={`p-3.5 rounded-xl border shadow-sm space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-card border-hairline'}`}>
                          <span className="text-xs font-mono text-cyan-700 dark:text-vibe-cyan uppercase font-bold block">2. Daypart Shading</span>
                          <div className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-fg'}`}>Time-of-Day Shading</div>
                          <p className={`text-xs font-sans leading-relaxed ${isLight ? 'text-slate-600' : 'text-fg-muted'}`}>
                            Shades bids lower in off-peak late night to conserve cash, bidding aggressively in primetime.
                          </p>
                        </div>
                        <div className={`p-3.5 rounded-xl border shadow-sm space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-card border-hairline'}`}>
                          <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 uppercase font-bold block">3. Micro-Signals</span>
                          <div className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-fg'}`}>Momentum &amp; Win Rate</div>
                          <p className={`text-xs font-sans leading-relaxed ${isLight ? 'text-slate-600' : 'text-fg-muted'}`}>
                            Detects competitor price surges across recent history and boosts bids if win rates dip.
                          </p>
                        </div>
                        <div className={`p-3.5 rounded-xl border shadow-sm space-y-1.5 ${isLight ? 'bg-slate-50 border-slate-200' : 'bg-card border-hairline'}`}>
                          <span className="text-xs font-mono text-amber-700 dark:text-amber-400 uppercase font-bold block">4. Safety Clamping</span>
                          <div className={`text-sm font-bold font-mono ${isLight ? 'text-slate-900' : 'text-fg'}`}>Ceiling &amp; Floor Limits</div>
                          <p className={`text-xs font-sans leading-relaxed ${isLight ? 'text-slate-600' : 'text-fg-muted'}`}>
                            Strictly enforces the maximum bid ceiling and minimum floor to prevent runaway auction costs.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Step 4: deploy_bidding_policy */}
                <div className={`p-5 rounded-2xl border transition-all space-y-3 ${
                  stepStatus[4] === 'running'
                    ? 'bg-amber-500/10 border-amber-500 text-fg shadow-md step-active-amber ring-1 ring-amber-500/40'
                    : stepStatus[4] === 'done' || completed
                    ? 'bg-card border-emerald-500/40 text-fg shadow-sm'
                    : 'bg-card/40 border-dashed border-hairline opacity-60 text-fg-muted'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${
                      stepStatus[4] === 'running'
                        ? 'bg-amber-500/20 border-amber-500 text-amber-700 dark:text-amber-300'
                        : stepStatus[4] === 'done' || completed
                        ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                        : 'bg-overlay border-hairline text-fg-muted'
                    }`}>
                      {stepStatus[4] === 'running' ? (
                        <RefreshCw size={16} className="animate-spin" />
                      ) : stepStatus[4] === 'done' || completed ? (
                        <Check size={16} />
                      ) : (
                        <FileCode2 size={16} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-base flex items-center gap-1.5 ${
                          stepStatus[4] === 'running'
                            ? 'font-bold text-amber-700 dark:text-amber-300'
                            : stepStatus[4] === 'done' || completed
                            ? 'font-bold text-emerald-700 dark:text-emerald-400'
                            : 'font-bold text-amber-700 dark:text-amber-400'
                        }`}>
                          4. <code className={`font-mono px-1.5 py-0.5 rounded text-xs ${codeTagClass}`}>deploy_bidding_policy</code> — Production Code Actuator
                        </span>
                        <span className="text-xs font-mono font-medium text-fg-muted">File Deployment</span>
                      </div>
                      <p className="text-fg-muted text-sm font-sans leading-relaxed">
                        {stepStatus[4] === 'running' ? (
                          <span className="text-amber-700 dark:text-amber-400 font-mono flex items-center gap-2">
                            <RefreshCw size={13} className="animate-spin" /> Validating Python AST and verifying compute_bid signature against AuctionContext test bench...
                          </span>
                        ) : (
                          <span>Validated Python AST, verified <code className={`font-mono px-1.5 py-0.5 rounded text-xs ${codeTagClass}`}>compute_bid(context)</code> signature, and atomically deployed to <code className={`font-mono px-1.5 py-0.5 rounded text-xs ${codeTagClass}`}>policies/agent_bidding_policy.py</code>.</span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Synthesized Production Policy Script */}
            {completed && generatedCode && (
              <div className="space-y-4 animate-rise pt-2">

                <div className="p-6 bg-card rounded-3xl border border-hairline shadow-2xl space-y-6">
                  <div className="rounded-2xl overflow-hidden border border-hairline bg-card shadow-md">
                    <PythonCodeHighlight
                      code={generatedCode}
                      filename="agent_bidding_policy.py"
                      editable={false}
                      showCopy={false}
                      className="max-h-[520px]"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => navigate('adk_eval')}
                      className="px-6 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-sm rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 shrink-0"
                    >
                      <span>Proceed to ADK Eval</span>
                      <ArrowRight size={15} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
