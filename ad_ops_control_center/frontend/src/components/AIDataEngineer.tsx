import { useState } from 'react';
import { 
  Code2, Database,
  ArrowRight, ArrowLeft, Cpu, Bot, Check,
  FileText
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';

type ToolId = 'get_campaign_info' | 'a2a_bigquery' | 'deploy_bidding_policy';

interface CodeExplanation {
  title: string;
  description: string;
}

interface ToolDetail {
  id: ToolId;
  boxLabel: string;
  targetLabel: string;
  themeColor: 'emerald' | 'cyan' | 'amber';
  targetSystem: string;
  toolCodeFilename: string;
  toolCodeSnippet: string;
  toolCodeExplanations: CodeExplanation[];
  agentModificationsSnippet: string;
  agentModificationsExplanations: CodeExplanation[];
}

const TOOLS_CONFIG: Record<ToolId, ToolDetail> = {
  get_campaign_info: {
    id: 'get_campaign_info',
    boxLabel: 'get_campaign_info()',
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
    agentModificationsExplanations: [
      {
        title: 'Import Function',
        description: 'Imports get_campaign_info from the shared lib.tools library.',
      },
      {
        title: 'Equip to LlmAgent',
        description: 'Adds the function to tools=[...], allowing the agent to autonomously fetch flight constraints before computing bids.',
      },
    ],
  },
  a2a_bigquery: {
    id: 'a2a_bigquery',
    boxLabel: 'A2A',
    targetLabel: 'BigQuery Data Engineering Agent',
    themeColor: 'cyan',
    targetSystem: 'Google Cloud Gemini Data Analytics & BigQuery Warehouse',
    toolCodeFilename: 'agent.py (DataAgentToolset Configuration)',
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

# 3. Instantiate native A2A toolset (equips ask_data_agent)
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
        description: 'Binds to the Gemini Data Analytics service, equipping the native ask_data_agent Agent-to-Agent tool.',
      },
    ],
    agentModificationsSnippet: `# 1. Import and instantiate ADK DataAgentToolset:
import google.auth
from google.adk.tools.data_agent.config import DataAgentToolConfig
from google.adk.tools.data_agent.credentials import DataAgentCredentialsConfig
from google.adk.tools.data_agent.data_agent_toolset import DataAgentToolset

credentials, _ = google.auth.default(
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)
cred_config = DataAgentCredentialsConfig(credentials=credentials)
tool_config = DataAgentToolConfig(
    api_endpoint="https://geminidataanalytics.googleapis.com",
    location="global",
)
data_agent_toolset = DataAgentToolset(
    credentials_config=cred_config,
    data_agent_tool_config=tool_config,
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
    agentModificationsExplanations: [
      {
        title: 'Toolset Configuration',
        description: 'Instantiates data_agent_toolset pointing to the regional Gemini Data Analytics endpoint.',
      },
      {
        title: 'A2A Communication Protocol',
        description: 'Registers the toolset so the agent can ask analytical questions directly to the BigQuery agent over A2A.',
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
    toolCodeExplanations: [
      {
        title: 'PEP 8 Line Formatting',
        description: 'Cleans and wraps synthesized Python code to 88 characters for consistent code style.',
      },
      {
        title: 'Direct Disk Deployment',
        description: 'Writes the code atomically to agent_bidding_policy.py where the ad simulator dynamically hot-reloads it.',
      },
    ],
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
    agentModificationsExplanations: [
      {
        title: 'Actuator Import',
        description: 'Imports the filesystem deployment actuator from lib.tools.',
      },
      {
        title: 'Agent Code Emission',
        description: 'Grants the agent the capability to deploy its synthesized mathematical formulas as executable Python code.',
      },
    ],
  },
};

export default function AIDataEngineer({ navigate }: { navigate: (v: string) => void }) {
  // Equipped states for each of the 3 tools
  const [equipped, setEquipped] = useState<Record<ToolId, boolean>>({
    get_campaign_info: false,
    a2a_bigquery: false,
    deploy_bidding_policy: false,
  });

  // Current active view: null = main diagram canvas, or specific ToolId for focused drill-down
  const [focusedToolId, setFocusedToolId] = useState<ToolId | null>(null);

  const equippedCount = Object.values(equipped).filter(Boolean).length;
  const allEquipped = equippedCount === 3;

  // Generate dynamic agent.py code based on which tools are currently equipped
  const generateAgentPyCode = () => {
    const hasCampaignInfo = equipped.get_campaign_info;
    const hasA2A = equipped.a2a_bigquery;
    const hasDeploy = equipped.deploy_bidding_policy;

    const imports: string[] = [
      'import os',
      'import sys',
      'from pathlib import Path',
      '',
    ];

    if (hasA2A) {
      imports.push('import google.auth');
    }
    imports.push('from google.adk.agents import LlmAgent');

    if (hasA2A) {
      imports.push('from google.adk.tools.data_agent.config import DataAgentToolConfig');
      imports.push('from google.adk.tools.data_agent.credentials import DataAgentCredentialsConfig');
      imports.push('from google.adk.tools.data_agent.data_agent_toolset import DataAgentToolset');
    }

    imports.push('');
    imports.push('# Add current directory to sys.path to resolve lib');
    imports.push('CURRENT_DIR = Path(__file__).resolve().parent');
    imports.push('if str(CURRENT_DIR) not in sys.path:');
    imports.push('    sys.path.insert(0, str(CURRENT_DIR))');
    imports.push('');
    imports.push('from lib.config import settings');

    const libTools: string[] = [];
    if (hasDeploy) libTools.push('deploy_bidding_policy');
    if (hasCampaignInfo) libTools.push('get_campaign_info');
    if (libTools.length > 0) {
      imports.push(`from lib.tools import ${libTools.join(', ')}`);
    }

    let a2aSetup = '';
    if (hasA2A) {
      a2aSetup = `
# Native ADK Data Agent Toolset connecting to Google Cloud's BigQuery Data Engineering Agent
credentials, _ = google.auth.default(
    scopes=["https://www.googleapis.com/auth/cloud-platform"]
)
cred_config = DataAgentCredentialsConfig(credentials=credentials)
tool_config = DataAgentToolConfig(
    api_endpoint="https://geminidataanalytics.googleapis.com",
    location="global",
)
data_agent_toolset = DataAgentToolset(
    credentials_config=cred_config,
    data_agent_tool_config=tool_config,
)
`;
    }

    const toolList: string[] = [];
    if (hasCampaignInfo) toolList.push('get_campaign_info');
    if (hasDeploy) toolList.push('deploy_bidding_policy');
    if (hasA2A) toolList.push('data_agent_toolset');

    const toolsSection = toolList.length > 0
      ? `tools=[
        ${toolList.map(t => `${t},`).join('\n        ')}
    ],`
      : `# Base agent definition (Tools unequipped)
    # Click on each diagram connection above to inspect and equip tools
    tools=[],`;

    return `"""Vibetube Campaign Manager ADK Agent Module."""

${imports.join('\n')}

SPEC_PATH = CURRENT_DIR / "bidding_policy_spec.md"

# Configure Google Cloud Vertex AI and Gemini Data Agents API
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "True")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", settings.project_id)
os.environ.setdefault("GOOGLE_CLOUD_LOCATION", settings.location)
${a2aSetup}
root_agent = LlmAgent(
    name="campaign_manager",
    model="gemini-2.5-flash",
    instruction=SPEC_PATH.read_text(encoding="utf-8"),
    ${toolsSection}
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

          <div className="flex items-center gap-3">
            {!isEquipped ? (
              <button
                onClick={() => setEquipped(prev => ({ ...prev, [tool.id]: true }))}
                className="px-5 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={15} />
                <span>Equip Tool</span>
              </button>
            ) : (
              <button
                onClick={() => setFocusedToolId(null)}
                className="px-5 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <span>Return to Agent</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Simplified Focused Architecture Diagram (Mirroring Canvas) */}
        <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={14} className="text-vibe-cyan" />
              Tool Connection Architecture
            </span>
            <span className="text-xs font-mono text-fg-muted">
              Target: <strong className="text-fg">{tool.targetLabel}</strong>
            </span>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 py-2">
            {/* Left Node: Bidding Policy Agent */}
            <div className="lg:w-72 p-4 bg-card rounded-2xl border-2 border-vibe-cyan/40 flex items-center gap-3 shadow-sm shrink-0">
              <div className="w-10 h-10 rounded-xl bg-vibe-cyan/15 border border-vibe-cyan/40 flex items-center justify-center text-vibe-cyan shrink-0 shadow-sm">
                <Bot size={22} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold font-display text-fg truncate">Bidding Policy Agent</h4>
                <span className="text-[10px] font-mono text-cyan-800 dark:text-vibe-cyan font-bold block truncate">Bidding Policy Agent (ADK)</span>
              </div>
            </div>

            {/* Middle Connection Box */}
            <div className={`flex-1 p-4 rounded-2xl border-2 flex items-center justify-between gap-3 shadow-md transition-all min-w-0 ${
              isEquipped
                ? 'bg-card border-emerald-500 shadow-emerald-500/10'
                : 'bg-card border-dashed border-hairline'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-3 h-3 rounded-full shrink-0 ${
                  isEquipped ? 'bg-emerald-500 shadow-sm' : 'bg-fg-muted/40'
                }`} />
                <span className="font-mono text-xs font-bold tracking-wide text-fg truncate">
                  {tool.boxLabel}
                </span>
              </div>
              <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border shrink-0 whitespace-nowrap ${
                isEquipped
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-overlay border-hairline text-fg-muted'
              }`}>
                {isEquipped ? '✓ Equipped' : 'Click "Equip Tool" above'}
              </span>
            </div>

            {/* Right Node: Target System */}
            <div className="lg:w-72 p-4 bg-card rounded-2xl border border-hairline flex items-center gap-3 shadow-sm shrink-0">
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                tool.themeColor === 'emerald'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                  : tool.themeColor === 'cyan'
                    ? 'bg-vibe-cyan/10 border-vibe-cyan/30 text-cyan-700 dark:text-vibe-cyan'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400'
              }`}>
                {tool.id === 'get_campaign_info' ? (
                  <Database size={20} />
                ) : tool.id === 'a2a_bigquery' ? (
                  <Bot size={20} />
                ) : (
                  <FileText size={20} />
                )}
              </div>
              <div className="overflow-hidden min-w-0">
                <h5 className="text-xs font-bold text-fg font-mono leading-tight truncate">{tool.targetLabel}</h5>
                <span className="text-[10px] font-mono text-fg-muted truncate block">
                  {tool.id === 'get_campaign_info' ? 'Ad Server Database' : tool.id === 'a2a_bigquery' ? 'Google Cloud Data Agent' : 'Production Policy Script'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stacked Code Viewers (2/3 width) with High-Level Explanations (1/3 width) */}
        <div className="space-y-8">
          {/* Section 1: Tool Implementation Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                <Code2 size={14} className="text-amber-600 dark:text-amber-400" /> Tool Implementation Code:
              </span>
              <span className="text-[11px] font-mono text-fg-muted">{tool.toolCodeFilename}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Code: 2/3 width (8 cols) */}
              <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-hairline bg-card shadow-md">
                <PythonCodeHighlight
                  code={tool.toolCodeSnippet}
                  filename={tool.toolCodeFilename}
                  editable={false}
                  className="max-h-[480px]"
                />
              </div>

              {/* Explanations: 1/3 width (4 cols) */}
              <div className="lg:col-span-4 space-y-3">
                <span className="text-[11px] font-mono font-bold text-fg-muted uppercase tracking-wider block">
                  How It Works
                </span>
                {tool.toolCodeExplanations.map((item, idx) => (
                  <div key={idx} className="p-4 bg-card rounded-2xl border border-hairline shadow-sm space-y-1">
                    <h5 className="text-xs font-bold font-mono text-fg">{item.title}</h5>
                    <p className="text-xs text-fg-muted leading-relaxed font-sans">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2: agent.py Modifications */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                <FileText size={14} className="text-vibe-cyan" /> agent.py Modifications:
              </span>
              <span className="text-[11px] font-mono text-fg-muted">agent.py</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Code: 2/3 width (8 cols) */}
              <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-hairline bg-card shadow-md">
                <PythonCodeHighlight
                  code={tool.agentModificationsSnippet}
                  filename="agent.py"
                  editable={false}
                  className="max-h-[480px]"
                />
              </div>

              {/* Explanations: 1/3 width (4 cols) */}
              <div className="lg:col-span-4 space-y-3">
                <span className="text-[11px] font-mono font-bold text-fg-muted uppercase tracking-wider block">
                  Agent Integration
                </span>
                {tool.agentModificationsExplanations.map((item, idx) => (
                  <div key={idx} className="p-4 bg-card rounded-2xl border border-hairline shadow-sm space-y-1">
                    <h5 className="text-xs font-bold font-mono text-fg">{item.title}</h5>
                    <p className="text-xs text-fg-muted leading-relaxed font-sans">{item.description}</p>
                  </div>
                ))}
              </div>
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
          <h1 className="text-3xl font-display font-bold tracking-tight text-fg">
            AI Data Engineer Studio
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Equip the Bidding Policy Agent with live database readers, BigQuery A2A analytics, and automated code deployment.
          </p>
        </div>

        {/* Action Button: Navigates to Step 6 when all 3 tools are equipped */}
        <div className="flex items-center gap-3">
          {allEquipped ? (
            <button
              onClick={() => navigate('agent_execution')}
              className="px-6 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg bg-vibe-cyan hover:bg-vibe-cyan/90 text-black hover:shadow-vibe-cyan/20 cursor-pointer animate-pulse"
            >
              <span>Proceed to Agent Execution (Step 6)</span>
              <ArrowRight size={15} />
            </button>
          ) : (
            <div className="px-5 py-2.5 bg-card text-fg-muted border border-hairline rounded-xl text-xs font-mono font-medium">
              <span>Equip All Tools to Proceed ({equippedCount}/3)</span>
            </div>
          )}
        </div>
      </div>

      {/* 1. Architecture Canvas Container */}
      <div className="p-8 bg-card rounded-3xl border border-hairline shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <div className="flex items-center gap-2">
            <Cpu size={16} className="text-vibe-cyan" />
            <h3 className="text-sm font-bold text-fg uppercase font-mono tracking-wider">
              Agent Architecture Canvas
            </h3>
          </div>
          <div className="text-xs font-mono text-fg-muted">
            Status: <span className="font-bold text-fg">{equippedCount} of 3</span> Connections Equipped
          </div>
        </div>

        {/* The Interactive Node Diagram */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center py-4 relative">
          {/* Left Side: Bidding Policy Agent */}
          <div className="lg:col-span-4 p-6 bg-card rounded-3xl border-2 border-vibe-cyan/40 shadow-xl flex flex-col items-center text-center space-y-3 relative z-10">
            <div className="w-16 h-16 rounded-2xl bg-vibe-cyan/15 border border-vibe-cyan/40 flex items-center justify-center text-vibe-cyan shadow-lg">
              <Bot size={32} />
            </div>
            <div>
              <h4 className="text-base font-bold font-display text-fg">Bidding Policy Agent</h4>
              <span className="text-[11px] font-mono text-cyan-800 dark:text-vibe-cyan font-bold block mt-0.5">Bidding Policy Agent (ADK)</span>
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
                className={`flex-1 p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-sm ${
                  equipped.get_campaign_info
                    ? 'bg-card border-emerald-500 shadow-emerald-500/10'
                    : 'bg-card border-dashed border-hairline hover:border-vibe-cyan'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${equipped.get_campaign_info ? 'bg-emerald-500 shadow-sm' : 'bg-fg-muted/40'}`} />
                  <span className="font-mono text-xs font-bold text-fg">
                    get_campaign_info()
                  </span>
                </div>
                <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border ${
                  equipped.get_campaign_info 
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300' 
                    : 'bg-overlay border-hairline text-fg-muted'
                }`}>
                  {equipped.get_campaign_info ? '✓ Equipped' : 'Click to Equip →'}
                </span>
              </div>

              {/* Right Target 1: Campaigns Table */}
              <div className="sm:w-80 p-4 bg-card rounded-2xl border border-hairline flex items-center gap-3 shrink-0 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
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
                className={`flex-1 p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-sm ${
                  equipped.a2a_bigquery
                    ? 'bg-card border-vibe-cyan shadow-vibe-cyan/10'
                    : 'bg-card border-dashed border-hairline hover:border-vibe-cyan'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${equipped.a2a_bigquery ? 'bg-vibe-cyan shadow-sm' : 'bg-fg-muted/40'}`} />
                  <span className="font-mono text-xs font-bold text-fg">
                    A2A (DataAgentToolset)
                  </span>
                </div>
                <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border ${
                  equipped.a2a_bigquery 
                    ? 'bg-vibe-cyan/15 border-vibe-cyan/40 text-cyan-800 dark:text-vibe-cyan' 
                    : 'bg-overlay border-hairline text-fg-muted'
                }`}>
                  {equipped.a2a_bigquery ? '✓ Equipped' : 'Click to Equip →'}
                </span>
              </div>

              {/* Right Target 2: BigQuery Data Engineering Agent */}
              <div className="sm:w-80 p-4 bg-card rounded-2xl border border-hairline flex items-center gap-3 shrink-0 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-vibe-cyan/10 border border-vibe-cyan/30 flex items-center justify-center text-cyan-700 dark:text-vibe-cyan shrink-0">
                  <Bot size={20} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-fg font-mono leading-tight">BigQuery Data Engineering Agent</h5>
                  <span className="text-[10px] font-mono text-fg-muted">Google Cloud Data Agent</span>
                </div>
              </div>
            </div>

            {/* Row 3: deploy_bidding_policy -> bidding_policy.py */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              {/* Middle Tool Box (Clickable) */}
              <div 
                onClick={() => setFocusedToolId('deploy_bidding_policy')}
                className={`flex-1 p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-sm ${
                  equipped.deploy_bidding_policy
                    ? 'bg-card border-amber-500 shadow-amber-500/10'
                    : 'bg-card border-dashed border-hairline hover:border-vibe-cyan'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${equipped.deploy_bidding_policy ? 'bg-amber-500 shadow-sm' : 'bg-fg-muted/40'}`} />
                  <span className="font-mono text-xs font-bold text-fg">
                    deploy_bidding_policy
                  </span>
                </div>
                <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border ${
                  equipped.deploy_bidding_policy 
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300' 
                    : 'bg-overlay border-hairline text-fg-muted'
                }`}>
                  {equipped.deploy_bidding_policy ? '✓ Equipped' : 'Click to Equip →'}
                </span>
              </div>

              {/* Right Target 3: bidding_policy.py */}
              <div className="sm:w-80 p-4 bg-card rounded-2xl border border-hairline flex items-center gap-3 shrink-0 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
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
            className="max-h-[640px]"
          />
        </div>
      </div>
    </div>
  );
}
