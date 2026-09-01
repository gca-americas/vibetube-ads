import { useState } from 'react';
import { 
  Sparkles, Terminal, Code2, Database, ShieldCheck, 
  CheckCircle2, ArrowRight, ArrowLeft, Cpu, Bot, Check,
  FileText, CheckCheck
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';
import SqlCodeHighlight from './SqlCodeHighlight';

type ToolId = 'get_campaign_info' | 'a2a_bigquery' | 'deploy_bidding_policy';

interface ToolDetail {
  id: ToolId;
  boxLabel: string;
  targetLabel: string;
  themeColor: 'emerald' | 'cyan' | 'amber';
  summary: string;
  targetSystem: string;
  toolCodeFilename: string;
  toolCodeSnippet: string;
  agentModificationsSnippet: string;
  complexitiesAbstracted: string[];
  diagramFlow: {
    source: string;
    action: string;
    target: string;
    response: string;
  };
}

const TOOLS_CONFIG: Record<ToolId, ToolDetail> = {
  get_campaign_info: {
    id: 'get_campaign_info',
    boxLabel: 'get_campaign_info()',
    targetLabel: 'Campaigns Table',
    themeColor: 'emerald',
    summary: 'Retrieves live campaign boundaries, total budget ($2,500), flight duration (24h), and bid ceiling ($10.00).',
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
    agentModificationsSnippet: `# 1. Import the tool function in agent.py:
from lib.tools import get_campaign_info

# 2. Add to LlmAgent tools list:
root_agent = LlmAgent(
    name="campaign_manager",
    model="gemini-2.5-flash",
    instruction=SPEC_PATH.read_text(encoding="utf-8"),
    tools=[
        get_campaign_info,  # <-- Equipped Campaign State Reader
    ],
)`,
    complexitiesAbstracted: [
      'Eliminates raw HTTP requests, retry policies, and network timeout handling',
      'Enforces strict schema validation via Pydantic model (CampaignInfo)',
      'Prevents the agent from guessing or hardcoding campaign constraints',
    ],
    diagramFlow: {
      source: 'Bidding Policy Agent',
      action: 'get_campaign_info() [HTTP GET]',
      target: 'Campaigns Database & Ad Server',
      response: 'CampaignInfo(budget=$2500.00, hours=24.0, ceiling=$10.00)',
    },
  },
  a2a_bigquery: {
    id: 'a2a_bigquery',
    boxLabel: 'A2A',
    targetLabel: 'BigQuery Data Engineering Agent',
    themeColor: 'cyan',
    summary: 'Dispatches natural language analytical inquiries to Google Cloud’s BigQuery Data Engineering Agent over the Agent-to-Agent protocol.',
    targetSystem: 'Google Cloud Gemini Data Analytics & BigQuery Warehouse',
    toolCodeFilename: 'agent.py (DataAgentToolset Configuration)',
    toolCodeSnippet: `from google.adk.tools.data_agent.data_agent_toolset import DataAgentToolset
from google.adk.tools.data_agent.config import DataAgentToolConfig
from google.adk.tools.data_agent.credentials import DataAgentCredentialsConfig

# 1. Authenticate with Google Cloud Application Default Credentials (ADC)
credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
cred_config = DataAgentCredentialsConfig(credentials=credentials)

# 2. Bind to Google Cloud BigQuery Data Engineering Agent endpoint
tool_config = DataAgentToolConfig(
    api_endpoint="https://geminidataanalytics.googleapis.com",
    location="global",
)

# 3. Instantiate native A2A toolset (equips ask_data_agent)
data_agent_toolset = DataAgentToolset(
    credentials_config=cred_config,
    data_agent_tool_config=tool_config,
)`,
    agentModificationsSnippet: `# 1. Import and instantiate ADK DataAgentToolset:
import google.auth
from google.adk.tools.data_agent.data_agent_toolset import DataAgentToolset
from google.adk.tools.data_agent.config import DataAgentToolConfig
from google.adk.tools.data_agent.credentials import DataAgentCredentialsConfig

credentials, _ = google.auth.default(scopes=["https://www.googleapis.com/auth/cloud-platform"])
data_agent_toolset = DataAgentToolset(
    credentials_config=DataAgentCredentialsConfig(credentials=credentials),
    data_agent_tool_config=DataAgentToolConfig(
        api_endpoint="https://geminidataanalytics.googleapis.com",
        location="global",
    ),
)

# 2. Add to LlmAgent tools list:
root_agent = LlmAgent(
    name="campaign_manager",
    model="gemini-2.5-flash",
    instruction=SPEC_PATH.read_text(encoding="utf-8"),
    tools=[
        get_campaign_info,
        data_agent_toolset,  # <-- Equipped Native BigQuery A2A Toolset
    ],
)`,
    complexitiesAbstracted: [
      'Eliminates rigid, hardcoded SQL strings that break when telemetry schemas evolve',
      'Autonomous schema discovery and partition scanning across 200,000 auction rows',
      'Dynamic statistical quantile computation (APPROX_QUANTILES for P90 clearing floors)',
      'Enterprise Google Cloud OAuth2 token lifecycle and multi-step analytical reasoning',
    ],
    diagramFlow: {
      source: 'Bidding Policy Agent',
      action: 'ask_data_agent("Analyze P90 clearing floors by daypart")',
      target: 'BigQuery Data Engineering Agent',
      response: 'Daypart P90s: Primetime ($9.83), Afternoon ($8.62), Late Night ($0.93)',
    },
  },
  deploy_bidding_policy: {
    id: 'deploy_bidding_policy',
    boxLabel: 'deploy_bidding_policy',
    targetLabel: 'bidding_policy.py',
    themeColor: 'amber',
    summary: 'Validates Python AST syntax, checks compute_bid signatures, formats code adhering to PEP 8, and deploys to disk.',
    targetSystem: 'Local Policy Repository & Ad Server Runtime',
    toolCodeFilename: 'lib/tools.py',
    toolCodeSnippet: `def deploy_bidding_policy(python_code: str, strategy_summary: str) -> str:
    """Deploys the synthesized Python bidding policy script directly to disk.

    Args:
        python_code: Complete Python script implementing compute_bid(context).
        strategy_summary: Explanation of market rationale and pricing logic.

    Returns:
        Confirmation message detailing deployment status and file location.
    """
    cleaned_code = _wrap_long_lines(python_code.strip(), max_len=88)
    OUTPUT_POLICY_PATH.write_text(cleaned_code, encoding="utf-8")
    return f"Successfully deployed bidding policy to {OUTPUT_POLICY_PATH.name}."`,
    agentModificationsSnippet: `# 1. Import deploy_bidding_policy in agent.py:
from lib.tools import deploy_bidding_policy

# 2. Add to LlmAgent tools list:
root_agent = LlmAgent(
    name="campaign_manager",
    model="gemini-2.5-flash",
    instruction=SPEC_PATH.read_text(encoding="utf-8"),
    tools=[
        get_campaign_info,
        deploy_bidding_policy,  # <-- Equipped Production Code Actuator
        data_agent_toolset,
    ],
)`,
    complexitiesAbstracted: [
      'AST compilation checks to guarantee valid Python syntax and parameter signatures',
      'PEP 8 formatting and 88-character max line wrapping for clean git diffs',
      'Atomic filesystem deployment to policies/agent_bidding_policy.py',
      'Hot-reloads policy into memory for the 600,000-auction simulation flight',
    ],
    diagramFlow: {
      source: 'Bidding Policy Agent',
      action: 'deploy_bidding_policy(python_code, strategy_summary)',
      target: 'Production Actuator & File Compiler',
      response: 'Successfully deployed bidding policy to agent_bidding_policy.py',
    },
  },
};

const SAMPLE_BIGQUERY_SQL = `-- Generated by Google Cloud BigQuery Data Engineering Agent
SELECT 
  daypart,
  APPROX_QUANTILES(clearing_cpm, 100)[OFFSET(90)] AS p90_clearing_cpm,
  AVG(CASE WHEN won THEN 1.0 ELSE 0.0 END) AS avg_win_rate,
  COUNT(1) AS total_auction_volume
FROM \`vibeflix-sandbox.vibetube_telemetry.auction_events\`
GROUP BY daypart
ORDER BY p90_clearing_cpm DESC;`;

const AI_GENERATED_PYTHON_SCRIPT = `"""Vibetube Ads - AI-Optimized Adaptive Bidding Policy
Authored by ADK Campaign Manager Agent via Google Cloud BigQuery Data Engineering Agent.
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

export default function AIDataEngineer({ navigate }: { navigate: (v: string) => void }) {
  // Equipped states for each of the 3 tools
  const [equipped, setEquipped] = useState<Record<ToolId, boolean>>({
    get_campaign_info: false,
    a2a_bigquery: false,
    deploy_bidding_policy: false,
  });

  // Current active view: null = main diagram canvas, or specific ToolId for focused drill-down
  const [focusedToolId, setFocusedToolId] = useState<ToolId | null>(null);

  // Execution states
  const [isRunning, setIsRunning] = useState(false);
  const [agentCompleted, setAgentCompleted] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const equippedCount = Object.values(equipped).filter(Boolean).length;
  const allEquipped = equippedCount === 3;

  const handleEquipAndReturn = (toolId: ToolId) => {
    setEquipped(prev => ({ ...prev, [toolId]: true }));
    setFocusedToolId(null);
  };

  const handleRunAgent = async () => {
    if (!allEquipped || isRunning) return;

    setIsRunning(true);
    setAgentCompleted(false);
    setStepIndex(1);

    // Step 1: Tool Call 1 (get_campaign_info)
    await new Promise(r => setTimeout(r, 1200));
    setStepIndex(2);

    // Step 2: Tool Call 2 (DataAgentToolset / ask_data_agent on GCP BigQuery Agent)
    await new Promise(r => setTimeout(r, 1600));
    setStepIndex(3);

    // Step 3: Tool Call 3 (deploy_bidding_policy)
    await new Promise(r => setTimeout(r, 1400));
    setStepIndex(4);
    setIsRunning(false);
    setAgentCompleted(true);
  };

  const handleDeployAndProceed = async () => {
    setDeploying(true);
    try {
      await fetch('/campaign/script?file=agent_bidding_policy.py', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'agent_bidding_policy.py', script: AI_GENERATED_PYTHON_SCRIPT }),
      });
      navigate('simulator3');
    } catch (e) {
      console.error('Failed to deploy AI script:', e);
      navigate('simulator3');
    } finally {
      setDeploying(false);
    }
  };

  // Generate dynamic agent.py code based on which tools are currently equipped
  const generateAgentPyCode = () => {
    const hasCampaignInfo = equipped.get_campaign_info;
    const hasA2A = equipped.a2a_bigquery;
    const hasDeploy = equipped.deploy_bidding_policy;

    if (!hasCampaignInfo && !hasA2A && !hasDeploy) {
      return `"""Vibetube Campaign Manager ADK Agent Module."""

from pathlib import Path
from google.adk.agents import LlmAgent

CURRENT_DIR = Path(__file__).resolve().parent
SPEC_PATH = CURRENT_DIR / "bidding_policy_spec.md"

# Base agent definition (Tools unequipped)
# Click on each diagram connection above to inspect and equip tools
root_agent = LlmAgent(
    name="campaign_manager",
    model="gemini-2.5-flash",
    instruction=SPEC_PATH.read_text(encoding="utf-8"),
)`;
    }

    const imports: string[] = ['from pathlib import Path'];
    if (hasA2A) imports.push('import google.auth');
    imports.push('from google.adk.agents import LlmAgent');

    if (hasA2A) {
      imports.push('from google.adk.tools.data_agent.config import DataAgentToolConfig');
      imports.push('from google.adk.tools.data_agent.credentials import DataAgentCredentialsConfig');
      imports.push('from google.adk.tools.data_agent.data_agent_toolset import DataAgentToolset');
    }

    const libTools: string[] = [];
    if (hasDeploy) libTools.push('deploy_bidding_policy');
    if (hasCampaignInfo) libTools.push('get_campaign_info');
    if (libTools.length > 0) {
      imports.push(`from lib.tools import ${libTools.join(', ')}`);
    }

    let a2aSetup = '';
    if (hasA2A) {
      a2aSetup = `
credentials, _ = google.auth.default(
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)
data_agent_toolset = DataAgentToolset(
    credentials_config=DataAgentCredentialsConfig(credentials=credentials),
    data_agent_tool_config=DataAgentToolConfig(
        api_endpoint="https://geminidataanalytics.googleapis.com",
        location="global",
    ),
)
`;
    }

    const toolList: string[] = [];
    if (hasCampaignInfo) toolList.push('get_campaign_info');
    if (hasDeploy) toolList.push('deploy_bidding_policy');
    if (hasA2A) toolList.push('data_agent_toolset');

    return `"""Vibetube Campaign Manager ADK Agent Module."""

${imports.join('\n')}

CURRENT_DIR = Path(__file__).resolve().parent
SPEC_PATH = CURRENT_DIR / "bidding_policy_spec.md"
${a2aSetup}
root_agent = LlmAgent(
    name="campaign_manager",
    model="gemini-2.5-flash",
    instruction=SPEC_PATH.read_text(encoding="utf-8"),
    tools=[
        ${toolList.map(t => `${t},`).join('\n        ')}
    ],
)`;
  };

  // --------------------------------------------------------------------------
  // FOCUSED SUB-PAGE VIEW (When a tool is clicked)
  // --------------------------------------------------------------------------
  if (focusedToolId) {
    const tool = TOOLS_CONFIG[focusedToolId];
    const isEquipped = equipped[focusedToolId];

    return (
      <div className="animate-rise pb-24 space-y-6 max-w-5xl mx-auto">
        {/* Navigation Bar & Header */}
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <button
            onClick={() => setFocusedToolId(null)}
            className="px-4 py-2 bg-overlay hover:bg-hairline text-fg text-xs font-mono font-medium rounded-xl border border-hairline transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft size={14} />
            <span>Back to Architecture Canvas</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-fg-muted">Target:</span>
            <span className="text-xs font-mono font-bold text-fg px-2.5 py-0.5 rounded-full bg-card border border-hairline">
              {tool.targetLabel}
            </span>
          </div>
        </div>

        {/* Page Title & Equip Action */}
        <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg border ${
                tool.themeColor === 'emerald'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : tool.themeColor === 'cyan'
                    ? 'bg-vibe-cyan/15 text-vibe-cyan border-vibe-cyan/30'
                    : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
              }`}>
                {tool.boxLabel}
              </span>
              <span className="text-xs font-mono text-fg-muted">{tool.targetSystem}</span>
            </div>
            <h2 className="text-2xl font-display font-bold text-fg">{tool.summary}</h2>
          </div>

          <div>
            {!isEquipped ? (
              <button
                onClick={() => handleEquipAndReturn(tool.id)}
                className="px-6 py-3 bg-gradient-to-r from-vibe-cyan to-vibe-blue hover:from-vibe-cyan/90 hover:to-vibe-blue/90 text-black font-bold rounded-2xl text-xs transition-all shadow-lg hover:shadow-vibe-cyan/20 flex items-center gap-2 cursor-pointer shrink-0"
              >
                <Check size={16} />
                <span>Equip Tool & Return to Canvas</span>
              </button>
            ) : (
              <div className="px-5 py-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs font-mono text-emerald-300 font-bold flex items-center gap-2">
                <CheckCheck size={16} className="text-emerald-400" />
                <span>Tool Already Equipped</span>
              </div>
            )}
          </div>
        </div>

        {/* Interaction Flow Diagram */}
        <div className="p-6 bg-stage/80 rounded-3xl border border-hairline shadow-lg space-y-3">
          <span className="text-[11px] font-mono font-bold text-fg-muted uppercase tracking-wider block">
            Interaction Flow & Target Abstraction
          </span>

          <div className="grid grid-cols-1 md:grid-cols-11 gap-3 items-center">
            {/* Source */}
            <div className="md:col-span-3 p-4 bg-card rounded-2xl border border-hairline text-center space-y-1">
              <span className="text-[10px] font-mono text-vibe-cyan font-bold uppercase block">Source</span>
              <div className="text-xs font-bold text-fg">{tool.diagramFlow.source}</div>
            </div>

            {/* Bridge */}
            <div className="md:col-span-3 text-center space-y-1">
              <span className="text-[10px] font-mono text-amber-300 px-2 py-0.5 bg-amber-400/10 rounded-full border border-amber-400/20 block truncate">
                {tool.diagramFlow.action}
              </span>
              <div className="w-full h-0.5 bg-gradient-to-r from-vibe-cyan to-amber-400 opacity-60 hidden md:block" />
            </div>

            {/* Target */}
            <div className="md:col-span-2 p-4 bg-card rounded-2xl border border-hairline text-center space-y-1">
              <span className="text-[10px] font-mono text-purple-400 font-bold uppercase block">Target</span>
              <div className="text-xs font-bold text-fg">{tool.diagramFlow.target}</div>
            </div>

            {/* Return */}
            <div className="md:col-span-3 p-4 bg-emerald-950/30 rounded-2xl border border-emerald-500/30 text-center space-y-1">
              <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase block">Response</span>
              <div className="text-[11px] font-mono text-white font-medium truncate">{tool.diagramFlow.response}</div>
            </div>
          </div>
        </div>

        {/* Complexities Abstracted */}
        <div className="p-5 bg-card rounded-3xl border border-hairline space-y-2.5 shadow-md">
          <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider block flex items-center gap-1.5">
            <ShieldCheck size={14} /> Complexities Abstracted Away
          </span>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            {tool.complexitiesAbstracted.map((item, idx) => (
              <div key={idx} className="p-3.5 bg-overlay rounded-2xl border border-hairline text-xs text-fg-muted leading-relaxed flex items-start gap-2">
                <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Code Viewers Grid: Tool Code & agent.py Modifications */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tool Implementation Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                <Code2 size={14} className="text-amber-400" /> Tool Implementation Code:
              </span>
              <span className="text-[11px] font-mono text-fg-muted">{tool.toolCodeFilename}</span>
            </div>
            <div className="rounded-2xl overflow-hidden border border-hairline bg-card shadow-lg">
              <PythonCodeHighlight
                code={tool.toolCodeSnippet}
                filename={tool.toolCodeFilename}
                editable={false}
                className="max-h-[280px]"
              />
            </div>
          </div>

          {/* agent.py Modifications */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                <FileText size={14} className="text-vibe-cyan" /> agent.py Modifications:
              </span>
              <span className="text-[11px] font-mono text-fg-muted">agent.py</span>
            </div>
            <div className="rounded-2xl overflow-hidden border border-hairline bg-card shadow-lg">
              <PythonCodeHighlight
                code={tool.agentModificationsSnippet}
                filename="agent.py"
                editable={false}
                className="max-h-[280px]"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MAIN ARCHITECTURE CANVAS VIEW
  // --------------------------------------------------------------------------
  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-vibe-cyan/15 text-vibe-cyan border border-vibe-cyan/30 text-[11px] font-mono font-semibold">
              Step 8 & 9: Agent Toolset & A2A Integration
            </span>
            <span className="text-xs font-mono text-fg-muted">Google Cloud ADK 2.0</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-fg">AI Data Engineer Studio</h1>
          <p className="text-xs text-fg-muted mt-1 font-mono">
            Click on each connection box below to inspect its interface and equip the agent.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {!agentCompleted ? (
            <button
              onClick={handleRunAgent}
              disabled={!allEquipped || isRunning}
              className={`px-7 py-3 font-bold rounded-2xl text-xs transition-all shadow-lg flex items-center gap-2 cursor-pointer ${
                allEquipped
                  ? 'bg-gradient-to-r from-vibe-cyan to-vibe-blue text-black shadow-[0_0_30px_rgba(45,212,191,0.35)] hover:shadow-[0_0_45px_rgba(45,212,191,0.5)] hover:scale-105'
                  : 'bg-overlay text-fg-muted border border-hairline cursor-not-allowed opacity-50'
              }`}
              title={allEquipped ? 'Execute the Campaign Manager Agent' : 'Equip all 3 tools below to unlock execution'}
            >
              <Sparkles size={16} className={isRunning ? 'animate-spin' : ''} />
              <span>{isRunning ? 'Agent Synthesizing Policy...' : allEquipped ? '🚀 Execute Agent Workflow' : `Equip All Tools (${equippedCount}/3)`}</span>
            </button>
          ) : (
            <button
              onClick={handleDeployAndProceed}
              disabled={deploying}
              className="px-7 py-3 bg-emerald-400 hover:bg-emerald-300 text-black font-bold rounded-2xl text-xs transition-all shadow-[0_0_30px_rgba(52,211,153,0.4)] hover:scale-105 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <span>Proceed to Attempt 3 Simulation</span>
              <ArrowRight size={16} />
            </button>
          )}
        </div>
      </div>

      {/* 1. Main Interactive Architecture Canvas Diagram */}
      <div className="p-8 bg-card rounded-3xl border border-hairline shadow-2xl space-y-6 relative overflow-hidden">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-vibe-cyan" />
            <h3 className="text-sm font-bold text-fg uppercase font-mono tracking-wider">
              Agent Architecture & Tool Wiring Diagram
            </h3>
          </div>
          <div className="text-xs font-mono text-fg-muted">
            Status: <span className="font-bold text-fg">{equippedCount} of 3</span> Connections Equipped
          </div>
        </div>

        {/* The Interactive Node Diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center py-4 relative">
          {/* Left Side: Bidding Policy Agent */}
          <div className="lg:col-span-4 p-6 bg-stage rounded-3xl border-2 border-vibe-cyan/40 shadow-2xl flex flex-col items-center text-center space-y-3 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-vibe-cyan/15 border border-vibe-cyan/40 flex items-center justify-center text-vibe-cyan shadow-lg">
              <Bot size={32} />
            </div>
            <div>
              <h4 className="text-base font-bold font-display text-fg">Bidding Policy Agent</h4>
              <span className="text-[11px] font-mono text-vibe-cyan block mt-0.5">Campaign Manager (ADK)</span>
            </div>
            <p className="text-[11px] text-fg-muted font-mono leading-relaxed">
              Gemini reasoning engine authoring dynamic bidding policies.
            </p>
          </div>

          {/* Middle Connecting Paths & Right Targets */}
          <div className="lg:col-span-8 space-y-4 relative z-10">
            {/* Row 1: get_campaign_info() -> Campaigns Table */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Middle Tool Box (Clickable) */}
              <div 
                onClick={() => setFocusedToolId('get_campaign_info')}
                className={`flex-1 p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  equipped.get_campaign_info
                    ? 'bg-emerald-950/20 border-emerald-500/50 hover:border-emerald-400 shadow-md ring-1 ring-emerald-500/30'
                    : 'bg-overlay/60 border-hairline hover:border-hairline/80 hover:bg-overlay'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${equipped.get_campaign_info ? 'bg-emerald-400' : 'bg-fg-muted/40'}`} />
                  <span className={`font-mono text-xs font-bold ${equipped.get_campaign_info ? 'text-emerald-400' : 'text-fg-muted'}`}>
                    get_campaign_info()
                  </span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  equipped.get_campaign_info 
                    ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 font-bold' 
                    : 'bg-card border-hairline text-fg-muted'
                }`}>
                  {equipped.get_campaign_info ? '✓ Equipped' : 'Click to Equip →'}
                </span>
              </div>

              {/* Right Target 1: Campaigns Table */}
              <div className="sm:w-64 p-4 bg-stage rounded-2xl border border-hairline flex items-center gap-3 shrink-0 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                  <Database size={20} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-fg font-mono">Campaigns Table</h5>
                  <span className="text-[10px] font-mono text-fg-muted">Ad Server Database</span>
                </div>
              </div>
            </div>

            {/* Row 2: A2A -> BigQuery Data Engineering Agent */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Middle Tool Box (Clickable) */}
              <div 
                onClick={() => setFocusedToolId('a2a_bigquery')}
                className={`flex-1 p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  equipped.a2a_bigquery
                    ? 'bg-cyan-950/20 border-vibe-cyan/50 hover:border-vibe-cyan shadow-md ring-1 ring-vibe-cyan/30'
                    : 'bg-overlay/60 border-hairline hover:border-hairline/80 hover:bg-overlay'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${equipped.a2a_bigquery ? 'bg-vibe-cyan' : 'bg-fg-muted/40'}`} />
                  <span className={`font-mono text-xs font-bold ${equipped.a2a_bigquery ? 'text-vibe-cyan' : 'text-fg-muted'}`}>
                    A2A (DataAgentToolset)
                  </span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  equipped.a2a_bigquery 
                    ? 'bg-vibe-cyan/15 border-vibe-cyan/30 text-vibe-cyan font-bold' 
                    : 'bg-card border-hairline text-fg-muted'
                }`}>
                  {equipped.a2a_bigquery ? '✓ Equipped' : 'Click to Equip →'}
                </span>
              </div>

              {/* Right Target 2: BigQuery Data Engineering Agent */}
              <div className="sm:w-64 p-4 bg-stage rounded-2xl border border-hairline flex items-center gap-3 shrink-0 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-vibe-cyan/10 border border-vibe-cyan/30 flex items-center justify-center text-vibe-cyan shrink-0">
                  <Bot size={20} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-fg font-mono">BQ Data Eng Agent</h5>
                  <span className="text-[10px] font-mono text-fg-muted">Google Cloud Data Agent</span>
                </div>
              </div>
            </div>

            {/* Row 3: deploy_bidding_policy -> bidding_policy.py */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Middle Tool Box (Clickable) */}
              <div 
                onClick={() => setFocusedToolId('deploy_bidding_policy')}
                className={`flex-1 p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  equipped.deploy_bidding_policy
                    ? 'bg-amber-950/20 border-amber-500/50 hover:border-amber-400 shadow-md ring-1 ring-amber-500/30'
                    : 'bg-overlay/60 border-hairline hover:border-hairline/80 hover:bg-overlay'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${equipped.deploy_bidding_policy ? 'bg-amber-400' : 'bg-fg-muted/40'}`} />
                  <span className={`font-mono text-xs font-bold ${equipped.deploy_bidding_policy ? 'text-amber-400' : 'text-fg-muted'}`}>
                    deploy_bidding_policy
                  </span>
                </div>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                  equipped.deploy_bidding_policy 
                    ? 'bg-amber-500/15 border-amber-500/30 text-amber-300 font-bold' 
                    : 'bg-card border-hairline text-fg-muted'
                }`}>
                  {equipped.deploy_bidding_policy ? '✓ Equipped' : 'Click to Equip →'}
                </span>
              </div>

              {/* Right Target 3: bidding_policy.py */}
              <div className="sm:w-64 p-4 bg-stage rounded-2xl border border-hairline flex items-center gap-3 shrink-0 shadow-md">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                  <FileText size={20} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-fg font-mono">bidding_policy.py</h5>
                  <span className="text-[10px] font-mono text-fg-muted">Production Policy Script</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Dynamic agent.py Code Viewer */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-vibe-cyan" />
            <h3 className="text-sm font-bold text-fg uppercase font-mono tracking-wider">
              2. agent.py Code Definition (Live Assembly)
            </h3>
          </div>
          <span className="text-xs font-mono text-fg-muted">
            {allEquipped ? '✓ All Tools Registered in tools=[...]' : 'Updates dynamically as tools are equipped above'}
          </span>
        </div>

        <div className="rounded-3xl overflow-hidden border border-hairline bg-card shadow-xl">
          <PythonCodeHighlight
            code={generateAgentPyCode()}
            filename="lab_01_yield_optimization/agent.py"
            editable={false}
            className="max-h-[360px]"
          />
        </div>
      </div>

      {/* 3. Live Execution Trace & Synthesized Code (When Executed) */}
      {(stepIndex > 0 || agentCompleted) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-rise">
          {/* Left: Execution Timeline */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
                <Terminal size={15} className="text-vibe-cyan" />
                <span>Live Multi-Agent Execution Trace</span>
              </div>
              {agentCompleted && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold">
                  <Check size={12} /> Complete
                </span>
              )}
            </div>

            <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-3 font-mono text-xs">
              {/* Step 1: get_campaign_info */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                stepIndex >= 1 ? 'bg-overlay border-emerald-500/40 text-fg' : 'bg-overlay/40 border-hairline text-fg-muted opacity-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    stepIndex > 1 ? 'bg-emerald-400 text-black' : stepIndex === 1 ? 'bg-vibe-cyan text-black animate-pulse' : 'bg-overlay text-fg-muted'
                  }`}>
                    {stepIndex > 1 ? '✓' : '1'}
                  </div>
                  <div>
                    <span className="font-bold text-emerald-400">get_campaign_info():</span>
                    <span className="text-fg-muted ml-1.5">Read $2,500 budget, 24.0h duration, $10.00 ceiling</span>
                  </div>
                </div>
              </div>

              {/* Step 2: BigQuery Data Agent A2A */}
              <div className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                stepIndex >= 2 ? 'bg-overlay border-vibe-cyan/40 text-fg' : 'bg-overlay/40 border-hairline text-fg-muted opacity-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    stepIndex > 2 ? 'bg-emerald-400 text-black' : stepIndex === 2 ? 'bg-vibe-cyan text-black animate-pulse' : 'bg-overlay text-fg-muted'
                  }`}>
                    {stepIndex > 2 ? '✓' : '2'}
                  </div>
                  <div>
                    <span className="font-bold text-vibe-cyan">ask_data_agent (A2A):</span>
                    <span className="text-fg-muted ml-1.5">Queried Google Cloud BigQuery Data Agent</span>
                  </div>
                </div>

                {stepIndex >= 2 && (
                  <div className="pl-8 pt-1">
                    <div className="rounded-xl overflow-hidden border border-hairline bg-card/80">
                      <SqlCodeHighlight
                        code={SAMPLE_BIGQUERY_SQL}
                        showLineNumbers={false}
                        className="max-h-[130px]"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Step 3: deploy_bidding_policy */}
              <div className={`p-3.5 rounded-xl border transition-all ${
                stepIndex >= 3 ? 'bg-overlay border-amber-500/40 text-fg' : 'bg-overlay/40 border-hairline text-fg-muted opacity-50'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    stepIndex >= 4 ? 'bg-emerald-400 text-black' : stepIndex === 3 ? 'bg-vibe-cyan text-black animate-pulse' : 'bg-overlay text-fg-muted'
                  }`}>
                    {stepIndex >= 4 ? '✓' : '3'}
                  </div>
                  <div>
                    <span className="font-bold text-amber-400">deploy_bidding_policy():</span>
                    <span className="text-fg-muted ml-1.5">Compiled & written to policies/agent_bidding_policy.py</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Synthesized Code Preview */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
                <Code2 size={15} className="text-amber-400" />
                <span>Synthesized Bidding Policy</span>
              </div>
              <span className="text-[11px] font-mono text-fg-muted">policies/agent_bidding_policy.py</span>
            </div>

            <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-4">
              <div className="rounded-2xl overflow-hidden border border-hairline bg-overlay">
                <PythonCodeHighlight
                  code={AI_GENERATED_PYTHON_SCRIPT}
                  filename="agent_bidding_policy.py"
                  editable={false}
                  className="max-h-[300px]"
                />
              </div>

              {agentCompleted && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 animate-rise">
                  <div className="flex items-center gap-2 text-xs font-mono text-emerald-300">
                    <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
                    <span>Policy deployed & ready for 600,000 auction flight</span>
                  </div>
                  <button
                    onClick={handleDeployAndProceed}
                    className="px-5 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <span>Launch Attempt 3 Simulation</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
