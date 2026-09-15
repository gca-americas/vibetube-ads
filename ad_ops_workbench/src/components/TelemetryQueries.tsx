import { useState } from 'react';
import { Copy, Check, ExternalLink } from 'lucide-react';
import SqlCodeHighlight from './SqlCodeHighlight';

interface TelemetryQuery {
  id: string;
  tier: string;
  badge: string;
  title: string;
  description: string;
  sql: string;
}

const TELEMETRY_QUERIES: TelemetryQuery[] = [
  {
    id: 'tier1',
    tier: 'Tier 1',
    badge: 'Raw Telemetry Snapshot',
    title: 'Tier 1: Raw Telemetry Inspection (Snapshot)',
    description: 'Inspect individual auction events to see how bids clear and verify data streams in BigQuery.',
    sql: `SELECT 
  timestamp, 
  daypart, 
  bid_cpm, 
  competitor_highest_bid_cpm, 
  win, 
  cost, 
  budget_remaining
FROM \`vibetube_telemetry.auction_events\`
WHERE campaign_id = 'camp-default'
ORDER BY timestamp DESC
LIMIT 10;`,
  },
  {
    id: 'tier2',
    tier: 'Tier 2',
    badge: 'Core Market Dynamics',
    title: 'Tier 2: Daypart Analysis (The Core Market Insight)',
    description: 'Group auction events by daypart to uncover competitor P90 clearing prices, win rates, and total spend.',
    sql: `SELECT 
  daypart,
  COUNT(*) AS total_auctions,
  ROUND(AVG(competitor_highest_bid_cpm), 2) AS avg_competitor_bid,
  ROUND(APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(90)], 2) AS market_price_cpm,
  ROUND(AVG(win) * 100, 1) AS win_rate_pct,
  ROUND(SUM(cost), 2) AS total_spend
FROM \`vibetube_telemetry.auction_events\`
WHERE campaign_id = 'camp-default'
GROUP BY daypart
ORDER BY market_price_cpm DESC;`,
  },
];

export default function TelemetryQueries() {
  const [selectedTier, setSelectedTier] = useState<string>('tier1');
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

  const currentQuery = TELEMETRY_QUERIES.find(q => q.id === selectedTier) || TELEMETRY_QUERIES[0];

  return (
    <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-5">
      {/* Tier Selector Tabs & BigQuery Studio Link */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {TELEMETRY_QUERIES.map(q => (
            <button
              key={q.id}
              type="button"
              onClick={() => setSelectedTier(q.id)}
              className={`px-3.5 py-1.5 rounded-xl text-sm transition-all cursor-pointer border ${
                selectedTier === q.id
                  ? 'bg-slate-900 text-white border-slate-800 dark:bg-white dark:text-slate-950 dark:border-white font-bold shadow-sm'
                  : 'bg-overlay text-fg-muted hover:text-fg hover:bg-hairline border-hairline'
              }`}
            >
              <span className="font-semibold">{q.tier}:</span> {q.badge}
            </button>
          ))}
        </div>

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

      {/* Selected Query Card */}
      {currentQuery && (
        <div className="bg-overlay/80 border border-hairline rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-hairline/60 pb-2">
            <div>
              <h3 className="text-sm font-bold text-fg">{currentQuery.title}</h3>
              <p className="text-xs text-fg-muted mt-0.5">{currentQuery.description}</p>
            </div>
            <button
              type="button"
              onClick={() => copyToClipboard(currentQuery.sql, currentQuery.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-mono font-semibold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 shadow-sm ${
                copiedId === currentQuery.id
                  ? 'bg-emerald-500 text-black font-bold'
                  : 'bg-overlay hover:bg-hairline text-fg border border-hairline hover:border-fg-muted/40'
              }`}
              title="Copy SQL for BigQuery Studio"
            >
              {copiedId === currentQuery.id ? (
                <>
                  <Check size={13} />
                  <span>Copied SQL!</span>
                </>
              ) : (
                <>
                  <Copy size={13} />
                  <span>Copy SQL</span>
                </>
              )}
            </button>
          </div>

          <SqlCodeHighlight code={currentQuery.sql} showLineNumbers={true} />
        </div>
      )}
    </div>
  );
}
