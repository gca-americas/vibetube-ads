import { useState } from 'react';
import { 
  Sparkles, Terminal, Code2, ShieldCheck, 
  CheckCircle2, ArrowRight, Cpu, Check,
  Lock, Layers, CheckCheck, RefreshCw
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';
import SqlCodeHighlight from './SqlCodeHighlight';

interface ToolDef {
  id: 'get_campaign_info' | 'data_agent_toolset' | 'deploy_bidding_policy';
  number: number;
  name: string;
  badge: string;
  role: string;
  themeColor: 'emerald' | 'cyan' | 'amber';
  summary: string;
  targetSystem: string;
  codeSnippet: string;
  complexitiesAbstracted: string[];
  diagram: {
    source: string;
    requestAction: string;
    target: string;
    subSteps?: string[];
    responsePayload: string;
  };
}

const TOOLS_DATA: ToolDef[] = [
  {
    id: 'get_campaign_info',
    number: 1,
    name: 'get_campaign_info',
    badge: 'Campaign State Reader',
    role: 'Deterministic API Client',
    themeColor: 'emerald',
    summary: 'Reads live campaign constraints, financial liquidity, and regulatory ceilings from the ad server.',
    targetSystem: 'Vibetube Ad Server REST API (/campaign/config)',
    codeSnippet: `def get_campaign_info() -> CampaignInfo:
    """Retrieves active campaign configuration parameters from the ad server.

    Returns:
        CampaignInfo: Pydantic model containing campaign budget ($2,500.00),
                      flight duration (24.0h), and max bid ceiling ($10.00).
    """
    url = f"{settings.ad_server_url}/campaign/config"
    res = requests.get(url, timeout=5)
    res.raise_for_status()
    return CampaignInfo.model_validate(res.json())`,
    complexitiesAbstracted: [
      'Network timeouts, retry policies, and HTTP 5xx/4xx error handling',
      'JSON deserialization and strict schema enforcement via Pydantic model',
      'Prevents the agent from hallucinating or hardcoding budget parameters ($2,500.00 budget, 24.0h duration, $10.00 ceiling)',
    ],
    diagram: {
      source: 'Campaign Manager Agent',
      requestAction: 'HTTP GET /campaign/config',
      target: 'Ad Server State Engine',
      subSteps: [
        'Query active memory store',
        'Extract remaining budget & ceiling',
        'Serialize into CampaignInfo schema',
      ],
      responsePayload: 'CampaignInfo(budget=$2500.00, hours=24.0, ceiling=$10.00)',
    },
  },
  {
    id: 'data_agent_toolset',
    number: 2,
    name: 'DataAgentToolset',
    badge: 'BigQuery Data Engineering Agent (A2A)',
    role: 'Autonomous Data Specialist',
    themeColor: 'cyan',
    summary: 'Dispatches natural language analytical inquiries to Google Cloud’s BigQuery Data Engineering Agent over the Agent-to-Agent protocol.',
    targetSystem: 'Google Cloud Gemini Data Analytics & BigQuery Warehouse (200k Events)',
    codeSnippet: `from google.adk.tools.data_agent.data_agent_toolset import DataAgentToolset
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
    complexitiesAbstracted: [
      'Dynamic BigQuery SQL generation without brittle hardcoded query strings',
      'Partition pruning and cluster scanning on timestamp and daypart columns',
      'High-cardinality statistical quantile analysis (APPROX_QUANTILES for P90 clearing CPMs)',
      'Enterprise OAuth2 token management and multi-step thought synthesis',
    ],
    diagram: {
      source: 'Campaign Manager (Strategist)',
      requestAction: 'ask_data_agent("Analyze P90 clearing floors across dayparts")',
      target: 'Google Cloud BigQuery Data Agent',
      subSteps: [
        '1. Inspect vibetube_telemetry table schemas',
        '2. Author dynamic SQL with APPROX_QUANTILES',
        '3. Execute query on BigQuery enterprise warehouse',
        '4. Perform Python statistical synthesis',
      ],
      responsePayload: 'P90 Clearances: Primetime ($9.83), Afternoon ($8.62), Late Night ($0.93)',
    },
  },
  {
    id: 'deploy_bidding_policy',
    number: 3,
    name: 'deploy_bidding_policy',
    badge: 'Production Policy Actuator',
    role: 'Compiler & Actuator Tool',
    themeColor: 'amber',
    summary: 'Validates Python AST bytecode, formats code adhering to PEP 8 line limits, and writes the compute_bid function to disk.',
    targetSystem: 'Local Policy Repository (policies/agent_bidding_policy.py) & Ad Server Memory',
    codeSnippet: `def deploy_bidding_policy(python_code: str, strategy_summary: str) -> str:
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
    complexitiesAbstracted: [
      'AST compilation checks to guarantee valid Python syntax and parameter signatures',
      'PEP 8 formatting and 88-character max line wrapping for clean git diffs',
      'Atomic filesystem deployment to policies/agent_bidding_policy.py',
      'Hot-reloading into ad server memory for the 600,000-auction simulation flight',
    ],
    diagram: {
      source: 'Campaign Manager (Synthesizer)',
      requestAction: 'deploy_bidding_policy(python_code, strategy_summary)',
      target: 'Production Actuator & Compiler',
      subSteps: [
        'Validate compute_bid(context: AuctionContext) signature',
        'Wrap long lines to <= 88 characters (PEP 8)',
        'Write atomic file to policies/agent_bidding_policy.py',
        'Hot-reload policy into Ad Server simulation engine',
      ],
      responsePayload: 'Successfully deployed bidding policy to agent_bidding_policy.py',
    },
  },
];

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
  // Equipped state: tracks which of the 3 tools have been equipped
  const [equippedTools, setEquippedTools] = useState<Record<string, boolean>>({
    get_campaign_info: false,
    data_agent_toolset: false,
    deploy_bidding_policy: false,
  });

  // Selected tool card for active inspection
  const [selectedToolId, setSelectedToolId] = useState<string>('get_campaign_info');

  // Execution states
  const [isRunning, setIsRunning] = useState(false);
  const [agentCompleted, setAgentCompleted] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);

  const equippedCount = Object.values(equippedTools).filter(Boolean).length;
  const allEquipped = equippedCount === 3;
  const activeTool = TOOLS_DATA.find(t => t.id === selectedToolId) || TOOLS_DATA[0];

  const handleEquipTool = (toolId: string) => {
    setEquippedTools(prev => {
      const next = { ...prev, [toolId]: true };
      return next;
    });

    // Automatically select the next unequipped tool
    if (toolId === 'get_campaign_info' && !equippedTools.data_agent_toolset) {
      setSelectedToolId('data_agent_toolset');
    } else if (toolId === 'data_agent_toolset' && !equippedTools.deploy_bidding_policy) {
      setSelectedToolId('deploy_bidding_policy');
    }
  };

  const handleResetEquipped = () => {
    setEquippedTools({
      get_campaign_info: false,
      data_agent_toolset: false,
      deploy_bidding_policy: false,
    });
    setSelectedToolId('get_campaign_info');
    setAgentCompleted(false);
    setStepIndex(0);
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
            Inspect tool abstraction layers, equip the agent with BigQuery A2A capabilities, and synthesize the bidding policy.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {equippedCount > 0 && (
            <button
              onClick={handleResetEquipped}
              className="px-4 py-2.5 bg-overlay hover:bg-hairline text-fg-muted hover:text-fg text-xs font-mono rounded-xl border border-hairline transition-all flex items-center gap-1.5 cursor-pointer"
              title="Reset tool equipping progression"
            >
              <RefreshCw size={13} />
              <span>Reset Tools</span>
            </button>
          )}

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

      {/* 1. Interactive Tool Equipping Grid & Progress */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-vibe-cyan" />
            <h3 className="text-sm font-bold text-fg uppercase font-mono tracking-wider">
              1. Agent Toolset (Interactive Progressive Unlock)
            </h3>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-xs font-mono text-fg-muted">
              Equipped: <span className="text-fg font-bold">{equippedCount}</span> / 3
            </div>
            <div className="w-24 h-2 bg-overlay rounded-full overflow-hidden border border-hairline">
              <div 
                className="h-full bg-gradient-to-r from-vibe-cyan to-emerald-400 transition-all duration-500 rounded-full"
                style={{ width: `${(equippedCount / 3) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* The 3 Tool Selector Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TOOLS_DATA.map((tool) => {
            const isEquipped = equippedTools[tool.id];
            const isSelected = selectedToolId === tool.id;

            return (
              <div
                key={tool.id}
                onClick={() => setSelectedToolId(tool.id)}
                className={`p-5 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between space-y-4 ${
                  isEquipped
                    ? isSelected
                      ? 'bg-card border-vibe-cyan shadow-xl ring-1 ring-vibe-cyan/50'
                      : 'bg-card/80 border-emerald-500/40 hover:border-emerald-400/80 shadow-md'
                    : isSelected
                      ? 'bg-card border-hairline shadow-lg ring-1 ring-fg-muted/40'
                      : 'bg-overlay/40 border-hairline/60 hover:border-hairline opacity-75 hover:opacity-100'
                }`}
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-overlay border border-hairline text-fg-muted font-semibold">
                      Tool {tool.number} of 3
                    </span>

                    {isEquipped ? (
                      <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30 animate-rise">
                        <Check size={12} /> Equipped
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-fg-muted flex items-center gap-1 bg-overlay px-2 py-0.5 rounded-full border border-hairline">
                        <Lock size={11} /> Unlocked
                      </span>
                    )}
                  </div>

                  <div>
                    <h4 className={`text-sm font-bold font-mono ${
                      isEquipped ? 'text-fg' : 'text-fg/80'
                    }`}>
                      {tool.name}
                    </h4>
                    <span className="text-[11px] text-vibe-cyan font-mono block mt-0.5">
                      {tool.badge}
                    </span>
                  </div>

                  <p className="text-xs text-fg-muted leading-relaxed line-clamp-2">
                    {tool.summary}
                  </p>
                </div>

                <div className="pt-2 border-t border-hairline/60 flex items-center justify-between text-xs font-mono">
                  <span className="text-[11px] text-fg-muted">
                    {isSelected ? '● Viewing Details' : 'Click to Inspect'}
                  </span>
                  <span className={`text-[11px] font-bold ${
                    isEquipped ? 'text-emerald-400' : 'text-vibe-cyan'
                  }`}>
                    {isEquipped ? 'Active ✓' : 'Inspect →'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Interactive Tool Inspection & Architectural Diagram Drawer */}
      <div className="p-6 bg-card rounded-3xl border border-hairline shadow-2xl space-y-6">
        {/* Drawer Header with Equip Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-vibe-cyan/20 text-vibe-cyan border border-vibe-cyan/40">
                Tool {activeTool.number}: {activeTool.name}
              </span>
              <span className="text-xs font-mono text-fg-muted">Target: {activeTool.targetSystem}</span>
            </div>
            <h3 className="text-base font-bold text-fg">{activeTool.summary}</h3>
          </div>

          <div>
            {!equippedTools[activeTool.id] ? (
              <button
                onClick={() => handleEquipTool(activeTool.id)}
                className="px-6 py-2.5 bg-gradient-to-r from-vibe-cyan to-vibe-blue hover:from-vibe-cyan/90 hover:to-vibe-blue/90 text-black font-bold rounded-xl text-xs transition-all shadow-md hover:shadow-vibe-cyan/20 flex items-center gap-2 cursor-pointer"
              >
                <Check size={15} />
                <span>Equip {activeTool.name}</span>
              </button>
            ) : (
              <div className="px-5 py-2.5 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-xs font-mono text-emerald-300 font-bold flex items-center gap-2">
                <CheckCheck size={16} className="text-emerald-400" />
                <span>Tool Equipped to Agent</span>
              </div>
            )}
          </div>
        </div>

        {/* Architectural Interaction Diagram */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
            <Layers size={15} className="text-vibe-cyan" />
            <span>Target Interaction & Complexity Abstraction Diagram</span>
          </div>

          {/* Interactive Flow Diagram Card */}
          <div className="p-5 bg-stage/80 rounded-2xl border border-hairline space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
              {/* Node 1: Calling Agent */}
              <div className="lg:col-span-3 p-4 bg-card rounded-2xl border border-vibe-cyan/30 text-center space-y-1.5 shadow-md">
                <span className="text-[10px] font-mono text-vibe-cyan font-bold uppercase tracking-wider block">Initiator</span>
                <div className="font-bold text-xs text-fg">{activeTool.diagram.source}</div>
                <div className="text-[10px] font-mono text-fg-muted">Gemini 2.5 Flash</div>
              </div>

              {/* Action Bridge */}
              <div className="lg:col-span-2 text-center flex flex-col items-center justify-center space-y-1">
                <span className="text-[10px] font-mono text-amber-300 font-semibold px-2 py-0.5 bg-amber-400/10 rounded-full border border-amber-400/20 max-w-full truncate">
                  {activeTool.diagram.requestAction}
                </span>
                <div className="w-full h-0.5 bg-gradient-to-r from-vibe-cyan via-amber-400 to-vibe-cyan opacity-60 hidden lg:block" />
                <ArrowRight size={16} className="text-amber-400 lg:hidden" />
              </div>

              {/* Node 2: Target & Sub-Steps */}
              <div className="lg:col-span-4 p-4 bg-card rounded-2xl border border-hairline space-y-2 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-purple-400 font-bold uppercase tracking-wider">Target System</span>
                  <span className="text-[10px] font-mono text-fg-muted">Autonomous Service</span>
                </div>
                <div className="font-bold text-xs text-fg">{activeTool.diagram.target}</div>

                {activeTool.diagram.subSteps && (
                  <div className="space-y-1 pt-1 border-t border-hairline font-mono text-[11px] text-fg-muted">
                    {activeTool.diagram.subSteps.map((step, idx) => (
                      <div key={idx} className="flex items-start gap-1.5">
                        <span className="text-vibe-cyan">›</span>
                        <span>{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Bridge Return */}
              <div className="lg:col-span-3 p-4 bg-emerald-950/30 rounded-2xl border border-emerald-500/30 space-y-1.5 shadow-md">
                <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-wider block">Structured Output</span>
                <div className="text-xs font-mono text-white font-medium break-words leading-relaxed">
                  {activeTool.diagram.responsePayload}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Detail: Complexities Abstracted & Python Tool Implementation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Left: What this Tool Abstracts Away */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
              <ShieldCheck size={15} className="text-emerald-400" />
              <span>Complexities Abstracted Away</span>
            </div>

            <div className="p-4 bg-overlay/60 rounded-2xl border border-hairline space-y-2.5">
              {activeTool.complexitiesAbstracted.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-fg-muted leading-relaxed">
                  <CheckCircle2 size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Actual Python Code Definition */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
                <Code2 size={15} className="text-amber-400" />
                <span>Python Tool Implementation</span>
              </div>
              <span className="text-[11px] font-mono text-fg-muted">lab_01_yield_optimization</span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-hairline bg-card shadow-lg">
              <PythonCodeHighlight
                code={activeTool.codeSnippet}
                filename={activeTool.id === 'data_agent_toolset' ? 'agent.py (DataAgentToolset)' : 'lib/tools.py'}
                editable={false}
                className="max-h-[220px]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Milestone Reward Banner: All Tools Equipped */}
      {allEquipped && (
        <div className="p-6 bg-gradient-to-r from-emerald-500/15 via-vibe-cyan/15 to-purple-500/15 border-2 border-emerald-500/50 rounded-3xl animate-rise shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-400/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 text-2xl shadow-lg shrink-0">
              🎉
            </div>
            <div>
              <h3 className="text-base font-bold text-fg flex items-center gap-2">
                <span>All 3 Tools Equipped! Agent Fully Assembled</span>
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-mono text-xs border border-emerald-400/30">
                  Ready for Execution
                </span>
              </h3>
              <p className="text-xs text-fg-muted mt-0.5 font-mono">
                The Campaign Manager Agent is equipped with live state readers, BigQuery A2A data intelligence, and deployment actuators.
              </p>
            </div>
          </div>

          <button
            onClick={handleRunAgent}
            disabled={isRunning}
            className="px-7 py-3 bg-gradient-to-r from-vibe-cyan to-vibe-blue hover:from-vibe-cyan/90 hover:to-vibe-blue/90 text-black font-bold rounded-2xl text-xs transition-all shadow-[0_0_25px_rgba(45,212,191,0.4)] hover:scale-105 flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Sparkles size={16} className={isRunning ? 'animate-spin' : ''} />
            <span>{isRunning ? 'Agent Synthesizing...' : '🚀 Execute Agent Workflow'}</span>
          </button>
        </div>
      )}

      {/* 4. Live Multi-Agent Execution Trace & Synthesized Code */}
      {(stepIndex > 0 || agentCompleted) && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-rise">
          {/* Left: Execution Timeline */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
                <Terminal size={15} className="text-vibe-cyan" />
                <span>Live Execution Trace</span>
              </div>
              {agentCompleted && (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1 font-bold">
                  <Check size={12} /> Execution Complete
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
