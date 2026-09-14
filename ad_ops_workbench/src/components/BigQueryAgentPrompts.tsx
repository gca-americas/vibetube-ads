import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';

interface AgentPrompt {
  id: string;
  title: string;
  description: string;
  prompt: string;
}

const BQ_AGENT_PROMPTS: AgentPrompt[] = [
  {
    id: 'prompt1',
    title: 'Prompt 1: Exploratory Discovery',
    description: 'Asks the agent to inspect the auction telemetry schema and suggest what queries to run to investigate spend and loss drivers.',
    prompt: 'I am analyzing our ad auction telemetry in vibetube_telemetry.auction_events. What kinds of queries or metrics should I look at to understand why our campaign ran out of budget early or lost high-value impressions?',
  },
  {
    id: 'prompt2',
    title: 'Prompt 2: Trend & Anomaly Analysis',
    description: 'Directs the agent to explore auction dynamics across time of day and uncover bidding wars or pricing anomalies.',
    prompt: 'Can you explore the auction data across different times of day (dayparts) and identify key trends, price surges, or anomalies in how competitors are bidding and winning?',
  },
  {
    id: 'prompt3',
    title: 'Prompt 3: Bidding Heuristics',
    description: 'Asks the agent to translate its clearing price findings into concrete bidding thresholds for a hand-coded Python heuristic.',
    prompt: 'Based on the market clearing prices and win rates across dayparts, what bidding strategy and bid thresholds would you recommend I code into a rule-based bidding heuristic?',
  },
];

export default function BigQueryAgentPrompts() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (e) {
      console.warn('Clipboard write failed:', e);
    }
  };

  return (
    <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-5">
      {/* Action Link */}
      <div className="flex justify-end">
        <a
          href="https://console.cloud.google.com/bigquery"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-bold text-cyan-800 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-200 hover:underline flex items-center gap-1.5 shrink-0"
        >
          <span>Open BigQuery Studio</span>
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Prompts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BQ_AGENT_PROMPTS.map(p => (
          <div key={p.id} className="bg-overlay/80 border border-hairline rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-fg">{p.title}</h3>
              <p className="text-xs text-fg-muted leading-relaxed">{p.description}</p>
              <div className="p-3 rounded-xl bg-card border border-hairline/60 text-xs font-mono text-fg italic mt-2 leading-relaxed">
                "{p.prompt}"
              </div>
            </div>

            <button
              type="button"
              onClick={() => copyToClipboard(p.prompt, p.id)}
              className={`w-full py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                copiedId === p.id
                  ? 'bg-emerald-500 text-black font-bold'
                  : 'bg-overlay hover:bg-hairline text-fg border border-hairline hover:border-fg-muted/40'
              }`}
              title="Copy prompt for BigQuery Agent"
            >
              {copiedId === p.id ? (
                <>
                  <Check size={13} />
                  <span>Copied Prompt!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy Prompt</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
