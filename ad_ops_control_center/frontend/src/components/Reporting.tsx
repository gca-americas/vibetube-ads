import { useState, useEffect } from 'react';
import { ArrowLeft, Play, Layers, Database, Sparkles, RefreshCw, Clock, CheckCircle2, Code2 } from 'lucide-react';
import SqlCodeHighlight from './SqlCodeHighlight';

const QUERY_1_SQL = `SELECT 
  COUNT(*) AS total_auctions,
  AVG(win) AS win_rate,
  MIN(competitor_highest_bid_cpm) AS min_competitor_bid,
  APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(90)] AS min_to_win_cpm,
  MAX(competitor_highest_bid_cpm) AS max_competitor_bid,
  SUM(cost) AS total_spend,
  MIN(budget_remaining) AS current_budget
FROM \`vibetube_telemetry.auction_events\`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 5 MINUTE);`;

const QUERY_2_SQL = `SELECT 
  TIMESTAMP_TRUNC(timestamp, MINUTE) AS time_window,
  ROUND(AVG(bid_cpm), 2) AS our_avg_bid,
  ROUND(AVG(competitor_highest_bid_cpm), 2) AS competitor_avg_bid,
  ROUND(AVG(win) * 100, 1) AS win_rate_pct,
  ROUND(SUM(cost), 4) AS spend
FROM \`vibetube_telemetry.auction_events\`
WHERE timestamp >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 20 MINUTE)
GROUP BY time_window
ORDER BY time_window DESC
LIMIT 5;`;

const QUERY_3_SQL = `SELECT 
  daypart,
  COUNT(*) AS total_auctions,
  ROUND(AVG(competitor_highest_bid_cpm), 2) AS avg_competitor_bid,
  ROUND(APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(90)], 2) AS p90_cpm,
  ROUND(AVG(win) * 100, 1) AS win_rate_pct
FROM \`vibetube_telemetry.auction_events\`
GROUP BY daypart
ORDER BY total_auctions DESC;`;

export default function Reporting({ navigate }: { navigate: (v: string) => void }) {
  const [activeTab, setActiveTab] = useState<'query1' | 'query2' | 'query3'>('query1');
  const [executingQuery, setExecutingQuery] = useState(false);
  const [queryRows, setQueryRows] = useState<any[]>([]);
  const [executionStats, setExecutionStats] = useState<{
    source: string;
    durationMs: number;
    rowCount: number;
  } | null>(null);

  const currentSql = activeTab === 'query1' ? QUERY_1_SQL : activeTab === 'query2' ? QUERY_2_SQL : QUERY_3_SQL;

  const runQuery = async (queryId: 'query1' | 'query2' | 'query3', sql: string) => {
    try {
      setExecutingQuery(true);
      const res = await fetch('/telemetry/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query_id: queryId, sql }),
      });
      if (res.ok) {
        const data = await res.json();
        setQueryRows(data.rows || []);
        setExecutionStats({
          source: data.source === 'bigquery_live' ? 'BigQuery Live Engine' : 'Telemetry Pipeline Engine',
          durationMs: data.execution_time_ms || 180,
          rowCount: data.total_rows || (data.rows ? data.rows.length : 0),
        });
      }
    } catch (e) {
      console.warn('Failed to execute query against backend:', e);
    } finally {
      setExecutingQuery(false);
    }
  };

  // Run query on mount and whenever tab changes
  useEffect(() => {
    runQuery(activeTab, currentSql);
  }, [activeTab]);

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Navigation Header */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('console')}
          className="text-fg-muted hover:text-fg flex items-center transition-colors text-sm font-medium uppercase tracking-widest gap-2"
        >
          <ArrowLeft size={16} /> Back to Console
        </button>

        <div className="flex gap-3">
          <button 
            onClick={() => navigate('campaigns')}
            className="px-4 py-2 bg-overlay hover:bg-hairline text-fg rounded-xl text-xs font-medium border border-hairline transition-all flex items-center gap-1.5"
          >
            <Layers size={14} /> Campaigns
          </button>
          <button 
            onClick={() => navigate('simulator')}
            className="px-4 py-2 bg-overlay hover:bg-hairline text-fg rounded-xl text-xs font-medium border border-hairline transition-all flex items-center gap-1.5"
          >
            <Play size={14} /> Auction Simulator
          </button>
          <button 
            onClick={() => navigate('policy')}
            className="px-4 py-2 bg-overlay hover:bg-hairline text-fg rounded-xl text-xs font-medium border border-hairline transition-all flex items-center gap-1.5"
          >
            <Code2 size={14} /> Bidding Policy
          </button>
        </div>
      </div>
      
      {/* Title & Refresh */}
      <div className="border-b border-hairline pb-4 flex justify-between items-end">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-bold uppercase tracking-wider">
              Step 3, 6, 9 · Data Audit Workspace
            </span>
          </div>
          <h1 className="text-3xl font-display font-bold mt-1">BigQuery Telemetry Queries</h1>
          <p className="text-fg-muted text-sm mt-1">
            Real-time auction telemetry streaming into BigQuery from active campaigns.
          </p>
        </div>

        <button 
          onClick={() => runQuery(activeTab, currentSql)}
          disabled={executingQuery}
          className="px-4 py-2 bg-overlay hover:bg-hairline text-fg rounded-xl text-xs font-medium border border-hairline transition-all flex items-center gap-2 cursor-pointer"
        >
          <RefreshCw size={14} className={executingQuery ? 'animate-spin' : ''} />
          <span>Re-Run Query</span>
        </button>
      </div>

      {/* Query Selector Tabs */}
      <div className="flex bg-card p-1.5 rounded-2xl border border-hairline max-w-2xl">
        <button
          onClick={() => setActiveTab('query1')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all ${
            activeTab === 'query1'
              ? 'bg-vibe-cyan/20 text-vibe-cyan border border-vibe-cyan/30 shadow-sm font-semibold'
              : 'text-fg-muted hover:text-fg'
          }`}
        >
          <Database size={14} />
          <span>Query 1: Snapshot</span>
        </button>
        <button
          onClick={() => setActiveTab('query2')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all ${
            activeTab === 'query2'
              ? 'bg-vibe-purple/20 text-vibe-purple border border-vibe-purple/30 shadow-sm font-semibold'
              : 'text-fg-muted hover:text-fg'
          }`}
        >
          <Sparkles size={14} />
          <span>Query 2: Trend</span>
        </button>
        <button
          onClick={() => setActiveTab('query3')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition-all ${
            activeTab === 'query3'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm font-semibold'
              : 'text-fg-muted hover:text-fg'
          }`}
        >
          <Clock size={14} />
          <span>Query 3: Dayparting</span>
        </button>
      </div>

      {/* Active Query Display Card */}
      <div className="p-8 bg-card border border-hairline rounded-3xl shadow-xl space-y-6">
        <div className="flex items-center justify-between border-b border-hairline pb-4 flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${
              activeTab === 'query1' ? 'bg-vibe-cyan/10 text-vibe-cyan border border-vibe-cyan/20' : 
              activeTab === 'query2' ? 'bg-vibe-purple/10 text-vibe-purple border border-vibe-purple/20' :
              'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            }`}>
              {activeTab === 'query1' ? <Database size={20} /> : activeTab === 'query2' ? <Sparkles size={20} /> : <Clock size={20} />}
            </div>
            <div>
              <h2 className="font-display font-bold text-lg text-fg">
                {activeTab === 'query1' ? 'Query 1: Real-Time Market Snapshot (5-Minute Window)' : 
                 activeTab === 'query2' ? 'Query 2: Multi-Window Trend Analysis (20-Minute History)' :
                 'Query 3: Daypart Performance Analysis (Morning, Afternoon, Primetime, Late Night)'}
              </h2>
              <p className="text-xs text-fg-muted mt-0.5">
                {activeTab === 'query1' 
                  ? 'Computes 90th percentile minimum clearing price and win rate over rolling 5 minutes.' 
                  : activeTab === 'query2'
                  ? 'Audits rolling 5-minute windows over the last 20 minutes to evaluate past bidding decisions and competitor pullbacks.'
                  : 'Groups all auction telemetry by daypart to reveal daily traffic rhythms and clearing floor distributions.'}
              </p>
            </div>
          </div>

          <button
            onClick={() => runQuery(activeTab, currentSql)}
            disabled={executingQuery}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-2 cursor-pointer shadow-md ${
              activeTab === 'query1'
                ? 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black border-vibe-cyan'
                : 'bg-vibe-purple hover:bg-vibe-purple/90 text-white border-vibe-purple'
            }`}
          >
            {executingQuery ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Executing Query...</span>
              </>
            ) : (
              <>
                <Play size={14} className="fill-current" />
                <span>Run Query</span>
              </>
            )}
          </button>
        </div>

        {/* Syntax-Highlighted SQL Code Block */}
        <div>
          <SqlCodeHighlight code={currentSql} />
        </div>

        {/* Live Query Output Results Table */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-fg uppercase tracking-wider">
                Query Results Output
              </span>
              {executionStats && (
                <span className="text-[11px] font-mono text-fg-muted flex items-center gap-1.5">
                  • <Clock size={12} /> {executionStats.durationMs}ms
                </span>
              )}
            </div>

            {executionStats && (
              <span className="text-[11px] font-mono text-emerald-400 bg-emerald-400/10 px-2.5 py-1 rounded-full border border-emerald-400/20 flex items-center gap-1.5">
                <CheckCircle2 size={12} />
                <span>{executionStats.source} ({executionStats.rowCount} {executionStats.rowCount === 1 ? 'row' : 'rows'})</span>
              </span>
            )}
          </div>

          <div className="p-5 bg-overlay border border-hairline rounded-2xl overflow-x-auto min-h-[140px] flex flex-col justify-center">
            {executingQuery ? (
              <div className="flex flex-col items-center justify-center py-6 text-fg-muted gap-2 font-mono text-xs">
                <RefreshCw size={20} className="animate-spin text-vibe-cyan" />
                <span>Executing BigQuery Standard SQL...</span>
              </div>
            ) : queryRows.length === 0 ? (
              <div className="text-center py-6 text-fg-muted font-mono text-xs">
                No rows returned. Click "Run Query" to execute.
              </div>
            ) : activeTab === 'query1' && ('total_auctions' in queryRows[0] || 'min_to_win_cpm' in queryRows[0]) ? (
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-hairline text-fg-muted">
                    <th className="pb-2.5 font-medium">total_auctions</th>
                    <th className="pb-2.5 font-medium">win_rate</th>
                    <th className="pb-2.5 font-medium">min_competitor_bid</th>
                    <th className="pb-2.5 font-medium">min_to_win_cpm</th>
                    <th className="pb-2.5 font-medium">max_competitor_bid</th>
                    <th className="pb-2.5 font-medium">total_spend</th>
                    <th className="pb-2.5 font-medium">current_budget</th>
                  </tr>
                </thead>
                <tbody>
                  {queryRows.map((row, idx) => (
                    <tr key={idx} className="text-fg">
                      <td className="pt-3 text-zinc-300 font-semibold">{Number(row.total_auctions || 10000).toLocaleString()}</td>
                      <td className="pt-3 text-vibe-cyan font-bold">{Number(row.win_rate || 0).toFixed(2)}</td>
                      <td className="pt-3 text-zinc-300">${Number(row.min_competitor_bid || 0).toFixed(2)}</td>
                      <td className="pt-3 text-amber-400 font-bold">${Number(row.min_to_win_cpm || 0).toFixed(2)}</td>
                      <td className="pt-3 text-zinc-300">${Number(row.max_competitor_bid || 0).toFixed(2)}</td>
                      <td className="pt-3 text-zinc-300">${Number(row.total_spend || 0).toFixed(2)}</td>
                      <td className="pt-3 text-emerald-400 font-bold">${Number(row.current_budget || 2500.0).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : activeTab === 'query2' && ('time_window' in queryRows[0] || 'our_avg_bid' in queryRows[0]) ? (
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-hairline text-fg-muted">
                    <th className="pb-2.5 font-medium">time_window</th>
                    <th className="pb-2.5 font-medium">our_avg_bid</th>
                    <th className="pb-2.5 font-medium">competitor_avg_bid</th>
                    <th className="pb-2.5 font-medium">win_rate_pct</th>
                    <th className="pb-2.5 font-medium">spend</th>
                  </tr>
                </thead>
                <tbody>
                  {queryRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-hairline/30 last:border-0 text-fg">
                      <td className="py-2.5 text-zinc-400">{String(row.time_window || '')}</td>
                      <td className="py-2.5 text-vibe-cyan font-bold">${Number(row.our_avg_bid || 0).toFixed(2)}</td>
                      <td className="py-2.5 text-zinc-300">${Number(row.competitor_avg_bid || 0).toFixed(2)}</td>
                      <td className="py-2.5 text-vibe-purple font-bold">{Number(row.win_rate_pct || 0).toFixed(1)}%</td>
                      <td className="py-2.5 text-emerald-400 font-medium">${Number(row.spend || 0).toFixed(4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-hairline text-fg-muted">
                    {Object.keys(queryRows[0]).map(k => (
                      <th key={k} className="pb-2.5 font-medium pr-4">{k}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {queryRows.map((row, idx) => (
                    <tr key={idx} className="border-b border-hairline/30 last:border-0 text-fg">
                      {Object.keys(queryRows[0]).map(k => (
                        <td key={k} className="py-2.5 pr-4 text-zinc-200">{String(row[k] ?? '')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Forward Link Banner to Step 4 & 8 */}
      <div className="p-5 bg-card border border-hairline rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
        <div>
          <h4 className="font-display font-bold text-sm text-fg">Ready to Update Your Bidding Policy?</h4>
          <p className="text-xs text-fg-muted mt-0.5">
            Use the telemetry findings above to manually author Python rules or let the ADK AI Data Engineer optimize in one-shot.
          </p>
        </div>

        <button
          onClick={() => navigate('policy')}
          className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(45,212,191,0.3)] flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
        >
          <Code2 size={14} /> Open Bidding Policy & AI Engineer ➔
        </button>
      </div>
    </div>
  );
}

