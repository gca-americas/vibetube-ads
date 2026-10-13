import { useState } from 'react';
import { Copy, Check, ExternalLink, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// Title and description live in locales/<lng>/bigQueryAgentPrompts.json under prompts.<id>.
// The prompt itself stays in English: it is pasted into the BigQuery agent as-is.
interface AgentPrompt {
  id: string;
  prompt: string;
}

const BQ_AGENT_PROMPTS: AgentPrompt[] = [
  {
    id: 'prompt1',
    prompt: 'I am analyzing our ad auction telemetry in vibetube_telemetry.auction_events. What kinds of queries or metrics should I look at to understand why our campaign ran out of budget early or lost high-value impressions?',
  },
  {
    id: 'prompt2',
    prompt: 'Can you explore the auction data across different times of day (dayparts) and identify key trends, price surges, or anomalies in how competitors are bidding and winning?',
  },
  {
    id: 'prompt3',
    prompt: 'Based on the market clearing prices and win rates across dayparts, what bidding strategy and bid thresholds would you recommend I code into a rule-based bidding heuristic?',
  },
];

export default function BigQueryAgentPrompts() {
  const { t } = useTranslation();
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
      {/* Header & Instructions for finding the Chat button in BigQuery Studio */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-overlay/80 border border-hairline rounded-2xl">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-vibe-cyan shrink-0" />
            <h3 className="text-sm font-bold text-fg">
              {t('bigQueryAgentPrompts.title')}
            </h3>
          </div>
          <p className="text-xs text-fg-muted leading-relaxed flex flex-wrap items-center gap-1.5">
            <span>{t('bigQueryAgentPrompts.instructionsBefore')}</span>
            <span className="inline-flex items-center px-1.5 py-0.5 bg-white rounded-md border border-slate-300 dark:border-slate-700 shadow-sm">
              <img
                src="/bq-chat.png"
                alt={t('bigQueryAgentPrompts.chatButtonAlt')}
                className="h-5 w-auto object-contain"
              />
            </span>
            <span>{t('bigQueryAgentPrompts.instructionsAfter')}</span>
          </p>
        </div>

        <a
          href="https://console.cloud.google.com/bigquery"
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-bold text-cyan-800 dark:text-cyan-300 hover:text-cyan-900 dark:hover:text-cyan-200 hover:underline flex items-center gap-1.5 shrink-0 self-start md:self-center"
        >
          <span>{t('bigQueryAgentPrompts.openStudio')}</span>
          <ExternalLink size={14} />
        </a>
      </div>

      {/* Prompts Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BQ_AGENT_PROMPTS.map(p => (
          <div key={p.id} className="bg-overlay/80 border border-hairline rounded-2xl p-4 flex flex-col justify-between gap-3 shadow-sm">
            <div className="space-y-1.5">
              <h3 className="text-sm font-bold text-fg">{t(`bigQueryAgentPrompts.prompts.${p.id}.title`)}</h3>
              <p className="text-xs text-fg-muted leading-relaxed">{t(`bigQueryAgentPrompts.prompts.${p.id}.description`)}</p>
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
              title={t('bigQueryAgentPrompts.copyTitle')}
            >
              {copiedId === p.id ? (
                <>
                  <Check size={13} />
                  <span>{t('bigQueryAgentPrompts.copied')}</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>{t('bigQueryAgentPrompts.copy')}</span>
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
