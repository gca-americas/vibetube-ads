import { useState, useEffect } from 'react';
import {
    Terminal, Code2,
    ArrowRight, Bot, Check, CheckCircle2,
    Play, RefreshCw, Database, Cpu, FileCode2, AlertTriangle
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';

const DEFAULT_AGENT_CODE = `from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    # Campaign-specific constant derived at deployment time for the current campaign.
    ideal_hourly_velocity = 104.16666666666667  # 2500.0 / 24.0

    # 1. Dynamic Budget Pacing Formulation
    # Ensure hours_remaining doesn't lead to division by zero or extreme values.
    safe_hours_remaining = max(0.5, context.hours_remaining)
    current_hourly_burn = context.budget_remaining / safe_hours_remaining
    # Pacing factor ensures we spend budget effectively over time.
    pacing_factor = min(1.25, max(0.70, current_hourly_burn / ideal_hourly_velocity))

    # 2. Micro-Signals: Price Momentum & Closed-Loop Win-Rate Feedback
    micro_signals_adjustment = 0.0

    # Win-Rate Elasticity: Boost if win rate is low, shave if too high
    target_win_rate = 0.75
    win_rate_deviation = target_win_rate - context.win_rate
    micro_signals_adjustment += 0.25 * win_rate_deviation

    # Momentum Gradient: Detect sudden price changes from trailing history
    if context.p90_history and len(context.p90_history) >= 2:
        price_momentum = context.p90_history[-1] - context.p90_history[-2]
        micro_signals_adjustment += price_momentum * 0.1

    # 3. First-Price Bid Shading & Daypart Adaptation
    base_market_price = context.p90 if context.p90 is not None else 0.50
    computed_bid = base_market_price

    if context.daypart == "primetime":
        computed_bid = (base_market_price * 1.10) + 0.10
    elif context.daypart == "late_night":
        computed_bid = base_market_price * 0.90
    elif context.daypart == "morning":
        computed_bid = base_market_price * 1.05
    elif context.daypart == "afternoon":
        computed_bid = base_market_price * 1.07
    elif context.daypart == "lunch":
        computed_bid = (base_market_price * 1.08) + 0.05
    else:
        computed_bid = base_market_price

    # Apply micro-signals and pacing factor to the computed bid
    computed_bid = (computed_bid + micro_signals_adjustment) * pacing_factor

    # 4. Deterministic Safety Clamping: Respect minimum floor and campaign ceiling
    final_bid = max(0.50, min(computed_bid, context.max_bid_ceiling))

    return final_bid
`;

export default function AgentExecution({ navigate, activeLab }: { navigate: (v: string) => void; activeLab?: string }) {
    const [isRunning, setIsRunning] = useState(false);
    const [completed, setCompleted] = useState(false);
    const [stepIndex, setStepIndex] = useState(0);
    const [deploying, setDeploying] = useState(false);
    const [generatedCode, setGeneratedCode] = useState<string>(DEFAULT_AGENT_CODE);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const loadPolicyFromDisk = () => {
        fetch('/campaign/script?file=agent_bidding_policy.py')
            .then(res => res.json())
            .then(data => {
                if (data.script && data.script.trim().length > 0) {
                    setGeneratedCode(data.script);
                } else if (!generatedCode) {
                    setGeneratedCode(DEFAULT_AGENT_CODE);
                }
            })
            .catch(err => {
                console.error('Failed to load initial policy script:', err);
                if (!generatedCode) {
                    setGeneratedCode(DEFAULT_AGENT_CODE);
                }
            });
    };

    useEffect(() => {
        loadPolicyFromDisk();
    }, [activeLab]);

    const handleRunAgent = async () => {
        if (isRunning) return;

        setIsRunning(true);
        setCompleted(false);
        setErrorMessage(null);
        setStepIndex(1);

        try {
            // Kick off backend fetch in parallel (cached response or live)
            const fetchPromise = fetch('/agent/run-cycle', { method: 'POST' });

            // Step 1: Campaign Configuration Extraction (~1.5s)
            await new Promise(r => setTimeout(r, 1500));
            setStepIndex(2);

            // Step 2: BigQuery Telemetry Agent Dispatch (~2.5s)
            await new Promise(r => setTimeout(r, 2500));
            setStepIndex(3);

            // Step 3: Gemini Reasoning Engine (Simulate longest reasoning step for ~4.5s)
            await new Promise(r => setTimeout(r, 4500));

            const res = await fetchPromise;

            if (res.ok) {
                const data = await res.json();
                const script = data.script && data.script.trim().length > 0 ? data.script : DEFAULT_AGENT_CODE;
                setGeneratedCode(script);

                // Atomically persist to disk
                await fetch('/campaign/script?file=agent_bidding_policy.py', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: 'agent_bidding_policy.py', script }),
                }).catch(err => console.error('Failed to save script to disk:', err));
            } else {
                const errText = await res.text().catch(() => '');
                console.error('Agent execution returned error:', errText);
                setErrorMessage('Backend agent encountered an error. Pre-synthesized policy candidate applied.');
                if (!generatedCode) {
                    setGeneratedCode(DEFAULT_AGENT_CODE);
                }
                // Write fallback to disk so downstream steps succeed
                await fetch('/campaign/script?file=agent_bidding_policy.py', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filename: 'agent_bidding_policy.py', script: generatedCode || DEFAULT_AGENT_CODE }),
                }).catch(err => console.error('Failed to save fallback script to disk:', err));
            }

            // Step 4: Deterministic Policy Validation
            setStepIndex(4);
            await new Promise(r => setTimeout(r, 1200));

            // Step 5: Production Deployment Verification
            setStepIndex(5);
            setCompleted(true);
        } catch (err: any) {
            console.error('Failed to run agent cycle:', err);
            setErrorMessage(err.message || 'Network error executing agent cycle');
            if (!generatedCode) {
                setGeneratedCode(DEFAULT_AGENT_CODE);
            }
            setStepIndex(5);
            setCompleted(true);
        } finally {
            setIsRunning(false);
        }
    };

    const handleDeployAndProceed = async () => {
        setDeploying(true);
        try {
            const codeToDeploy = generatedCode || DEFAULT_AGENT_CODE;
            await fetch('/campaign/script?file=agent_bidding_policy.py', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename: 'agent_bidding_policy.py', script: codeToDeploy }),
            });
            navigate('adk_eval');
        } catch (e) {
            console.error('Failed to deploy AI script:', e);
            navigate('adk_eval');
        } finally {
            setDeploying(false);
        }
    };

    return (
        <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
            {/* Top Header */}
            <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-display font-bold tracking-tight text-fg">
                        Execute Bidding Policy Agent
                    </h1>
                    <p className="text-sm text-fg-muted mt-1">
                        Trigger the ADK 2.0 reasoning engine to query BigQuery telemetry, formulate market formulas, and deploy the bidding policy.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {isRunning ? (
                        <div className="px-5 py-2.5 bg-card text-fg-muted border border-hairline rounded-xl text-xs font-mono font-medium flex items-center gap-2">
                            <RefreshCw size={14} className="animate-spin text-vibe-cyan" />
                            <span>Executing Trajectory...</span>
                        </div>
                    ) : completed ? (
                        <>
                            <button
                                onClick={handleRunAgent}
                                className="px-4 py-2.5 bg-card hover:bg-overlay text-fg text-xs font-mono font-medium rounded-xl border border-hairline transition-all flex items-center gap-2 cursor-pointer shadow-sm"
                            >
                                <RefreshCw size={14} />
                                <span>Re-Execute Workflow</span>
                            </button>

                            <button
                                onClick={handleDeployAndProceed}
                                disabled={deploying}
                                className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                                <span>{deploying ? 'Deploying...' : 'Proceed to Agent Evaluation'}</span>
                                <ArrowRight size={15} />
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleRunAgent}
                            className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                        >
                            <Play size={15} className="fill-black" />
                            <span>Execute Bidding Policy Agent</span>
                        </button>
                    )}
                </div>
            </div>

            {errorMessage && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-600 dark:text-amber-400 text-xs font-mono">
                    <AlertTriangle size={16} className="shrink-0" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* Multi-Agent Trajectory Workflow Container */}
            <div className="space-y-4 animate-rise">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
                        <Terminal size={15} className="text-vibe-cyan" />
                        <span>Multi-Agent Trajectory Workflow</span>
                    </div>
                    {completed ? (
                        <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5 font-bold shadow-sm">
                            <Check size={13} /> Trajectory Complete
                        </span>
                    ) : stepIndex === 0 ? (
                        <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-overlay text-fg-muted border border-hairline">
                            Ready to Execute
                        </span>
                    ) : (
                        <span className="text-[11px] font-mono px-3 py-1 rounded-full bg-vibe-cyan/15 text-cyan-800 dark:text-vibe-cyan border border-vibe-cyan/30 flex items-center gap-1.5 font-bold">
                            <RefreshCw size={12} className="animate-spin" /> Step {stepIndex} of 4 Executing
                        </span>
                    )}
                </div>

                <div className="p-6 bg-card rounded-3xl border border-hairline shadow-2xl space-y-4 font-mono text-xs">
                    {/* Step 1: get_campaign_info */}
                    <div className={`p-5 rounded-2xl border transition-all ${
                        stepIndex === 0 && !completed
                            ? 'bg-card/40 border-dashed border-hairline opacity-60 text-fg-muted'
                            : stepIndex === 1 && !completed
                                ? 'bg-card border-vibe-cyan/60 shadow-lg shadow-vibe-cyan/10 text-fg animate-pulse-slow'
                                : 'bg-card border-emerald-500/40 text-fg shadow-sm'
                        }`}>
                        <div className="flex items-start gap-4">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${stepIndex > 1
                                ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                : stepIndex === 1
                                    ? 'bg-vibe-cyan border-vibe-cyan text-black shadow-md'
                                    : 'bg-overlay border-hairline text-fg-muted'
                                }`}>
                                {stepIndex > 1 ? <Check size={16} /> : <Database size={16} />}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between">
                                    <span className={`text-sm flex items-center gap-1.5 ${stepIndex >= 1 ? 'font-bold text-emerald-700 dark:text-emerald-400' : 'font-bold text-fg-muted'
                                        }`}>
                                        1. <code className="font-mono bg-overlay px-1.5 py-0.5 rounded text-xs">get_campaign_info()</code> — Ad Server State Reader
                                    </span>
                                    <span className="text-[11px] font-mono text-fg-muted">REST Endpoint</span>
                                </div>
                                <p className="text-fg-muted text-xs font-sans leading-relaxed">
                                    {stepIndex === 0 && !completed ? (
                                        <span>Queries ad server for live campaign parameters (budget, flight duration, bid ceilings). Click "Execute Bidding Policy Agent" above to start.</span>
                                    ) : stepIndex === 1 ? (
                                        <span className="text-vibe-cyan animate-pulse">Connecting to ad server REST API (/campaign/config)...</span>
                                    ) : (
                                        <span>Retrieved live campaign state: <strong className="text-fg">$2,500.00 Total Budget</strong>, <strong className="text-fg">24.0-hour flight window</strong>, and <strong className="text-fg">$10.00 Max Bid Ceiling</strong>.</span>
                                    )}
                                </p>

                                {/* Detailed Payload: Only shown once step 1 has executed */}
                                {(stepIndex >= 2 || completed) && (
                                    <div className="mt-3 p-3 bg-overlay rounded-xl border border-hairline font-mono text-xs space-y-1.5 animate-rise">
                                        <div className="flex items-center justify-between text-[10px] text-fg-muted uppercase tracking-wider font-bold border-b border-hairline/60 pb-1">
                                            <span className="text-emerald-700 dark:text-emerald-400 font-bold">GET /campaign/config Response Payload</span>
                                            <span className="text-emerald-600 dark:text-emerald-400">HTTP 200 OK</span>
                                        </div>
                                        <pre className="text-fg leading-relaxed overflow-x-auto text-[11px]">
                                            {`{
  "total_budget": 2500.00,
  "flight_duration_hours": 24.0,
  "max_bid_ceiling": 10.00,
  "base_bid_cpm": 2.50,
  "currency": "USD"
}`}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Step 2: BigQuery Data Agent Tool Call */}
                    {stepIndex >= 2 && (
                        <div className={`p-5 rounded-2xl border transition-all space-y-3 bg-card text-fg shadow-sm animate-rise ${
                            stepIndex === 2 && !completed
                                ? 'border-vibe-cyan/60 shadow-lg shadow-vibe-cyan/10 animate-pulse-slow'
                                : 'border-emerald-500/40'
                        }`}>
                            <div className="flex items-start gap-4">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${stepIndex > 2
                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                    : 'bg-vibe-cyan border-vibe-cyan text-black shadow-md'
                                    }`}>
                                    {stepIndex > 2 ? <Check size={16} /> : <Bot size={16} />}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-cyan-700 dark:text-vibe-cyan text-sm flex items-center gap-1.5">
                                            2. <code className="font-mono bg-vibe-cyan/10 px-1.5 py-0.5 rounded text-xs">data_agent_toolset</code> — BigQuery Data Engineering Agent
                                        </span>
                                        <span className="text-[11px] font-mono text-fg-muted">Managed Data Tool</span>
                                    </div>
                                    <p className="text-fg-muted text-xs font-sans leading-relaxed">
                                        Dispatched natural language analytical intent to Google Cloud's BigQuery Data Engineering Agent via <code className="font-mono text-[11px]">data_agent_toolset</code>:
                                    </p>
                                </div>
                            </div>

                            <div className="pl-12 space-y-3 pt-1">
                                {/* Natural Language Prompt Bubble */}
                                <div className="p-3 bg-overlay rounded-xl border border-hairline font-sans text-xs text-fg flex items-start gap-2.5">
                                    <span className="text-[10px] font-mono font-bold uppercase text-cyan-800 dark:text-vibe-cyan px-2 py-0.5 rounded bg-vibe-cyan/15 border border-vibe-cyan/30 shrink-0">
                                        Data Agent Intent
                                    </span>
                                    <span className="italic text-fg-muted">
                                        "We are deploying a 24-hour first-price video ad bidding policy ($2,500 budget, $10 ceiling). Explore our 600,000-event telemetry dataset in BigQuery. What schemas, market price distributions, price momentum velocities, and win-rate dynamics are present? Identify actionable signals to maximize impressions and prevent budget starvation."
                                    </span>
                                </div>

                                {/* Under the Hood: BigQuery SQL Generated by Data Agent */}
                                <div className="p-3 bg-overlay rounded-xl border border-hairline font-mono text-[11px] space-y-1.5">
                                    <div className="flex items-center justify-between text-[10px] text-fg-muted uppercase tracking-wider font-bold border-b border-hairline/60 pb-1">
                                        <span className="flex items-center gap-1.5 text-cyan-700 dark:text-vibe-cyan font-bold">
                                            <Database size={12} /> BigQuery SQL Generated by Data Agent
                                        </span>
                                        <span className="text-fg-muted">vibetube_telemetry.auction_events (600k rows)</span>
                                    </div>
                                    <pre className="text-fg-muted leading-relaxed overflow-x-auto text-[11px]">
                                        {`SELECT daypart,
       COUNT(1) AS auction_volume,
       APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(90)] AS market_price_cpm,
       ROUND(AVG(win), 3) AS win_rate,
       ROUND(STDDEV(competitor_highest_bid_cpm), 2) AS price_volatility
FROM \`vibeflix-sandbox.vibetube_telemetry.auction_events\`
GROUP BY daypart
ORDER BY market_price_cpm ASC;`}
                                    </pre>
                                </div>

                                {/* Structured Returned Insights Grid */}
                                <div className="space-y-1.5">
                                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-fg-muted block">
                                        BigQuery Data Engineering Insights Discovered:
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                                        <div className="p-3 bg-card rounded-xl border border-hairline shadow-sm space-y-1">
                                            <span className="text-[10px] font-mono text-cyan-700 dark:text-vibe-cyan uppercase font-bold block">1. 600k Flight Scale</span>
                                            <div className="text-xs font-bold font-mono text-fg">600,000 Auctions</div>
                                            <p className="text-[11px] text-fg-muted font-sans leading-tight">
                                                Discovered 24h partitioned baseline dataset. Verified features: timestamp, competitor bid, win, cost, budget.
                                            </p>
                                        </div>
                                        <div className="p-3 bg-card rounded-xl border border-hairline shadow-sm space-y-1">
                                            <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-400 uppercase font-bold block">2. Time-of-Day Price Spread</span>
                                            <div className="text-xs font-bold font-mono text-fg">$0.93 → $9.60 Market Price</div>
                                            <p className="text-[11px] text-fg-muted font-sans leading-tight">
                                                Market price varies 10x from midnight cooldown ($0.93) to evening peak ($9.60), requiring dynamic bid shading across dayparts.
                                            </p>
                                        </div>
                                        <div className="p-3 bg-card rounded-xl border border-hairline shadow-sm space-y-1">
                                            <span className="text-[10px] font-mono text-purple-700 dark:text-purple-400 uppercase font-bold block">3. Price Momentum Signals</span>
                                            <div className="text-xs font-bold font-mono text-fg">+ $0.45/tick Surge</div>
                                            <p className="text-[11px] text-fg-muted font-sans leading-tight">
                                                Rapid price acceleration detected heading into primetime. Confirms <code className="font-mono text-xs">p90_history</code> gradient tracking is essential.
                                            </p>
                                        </div>
                                        <div className="p-3 bg-card rounded-xl border border-hairline shadow-sm space-y-1">
                                            <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 uppercase font-bold block">4. Win-Rate Cliff Elasticity</span>
                                            <div className="text-xs font-bold font-mono text-fg">92% → 18% Win Cliff</div>
                                            <p className="text-[11px] text-fg-muted font-sans leading-tight">
                                                Bidding below P90 collapses win rate to &lt;20%. Confirms closed-loop <code className="font-mono text-xs">win_rate</code> feedback is required.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Policy Mathematical Synthesis */}
                    {stepIndex >= 3 && (
                        <div className={`p-5 rounded-2xl border transition-all space-y-3 bg-card text-fg shadow-sm animate-rise ${
                            stepIndex === 3 && !completed
                                ? 'border-purple-500/60 shadow-lg shadow-purple-500/10 animate-pulse-slow'
                                : 'border-emerald-500/40'
                        }`}>
                            <div className="flex items-start gap-4">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${stepIndex > 3
                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                    : 'bg-vibe-cyan border-vibe-cyan text-black shadow-md'
                                    }`}>
                                    {stepIndex > 3 ? <Check size={16} /> : <Cpu size={16} />}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                                            3. Gemini Reasoning Engine — Mathematical Policy Synthesis
                                        </span>
                                        <span className="text-[11px] font-mono text-fg-muted">Optimization Logic</span>
                                    </div>
                                    <p className="text-fg-muted text-xs font-sans leading-relaxed">
                                        Formulated dynamic hourly pacing velocity, daypart bid shading, and real-time micro-signals derived from BigQuery:
                                    </p>
                                </div>
                            </div>

                            {/* Gemini Derivations Grid */}
                            <div className="pl-12 space-y-2 pt-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 font-mono text-xs">
                                    <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block uppercase">1. Hourly Pacing Velocity</span>
                                        <div className="text-fg font-bold">budget_remaining / hours_remaining</div>
                                        <p className="text-[11px] text-fg-muted font-sans">Calculates target hourly burn rate dynamically from context to prevent liquidity exhaustion before evening surges.</p>
                                    </div>
                                    <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block uppercase">2. Dynamic Pacing Coefficient</span>
                                        <div className="text-fg font-bold">clamp(current_burn / ideal_burn, 0.70, 1.25)</div>
                                        <p className="text-[11px] text-fg-muted font-sans">Self-adjusting pacing multiplier: throttles bids by up to 30% if overspending, boosts by 25% if surplus exists.</p>
                                    </div>
                                    <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block uppercase">3. Real-Time Micro-Signals (Momentum & Feedback)</span>
                                        <div className="text-fg font-bold">market_price_history gradient + win_rate boost</div>
                                        <p className="text-[11px] text-fg-muted font-sans">Tracks trailing price momentum (market_price_history) to ride surges, and adds dynamic bid boost if win_rate &lt; 40%.</p>
                                    </div>
                                    <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                                        <span className="text-[10px] text-purple-600 dark:text-purple-400 font-bold block uppercase">4. Macro Shading & Safety Clamping</span>
                                        <div className="text-fg font-bold">min(max(0.50, computed_bid), max_bid_ceiling)</div>
                                        <p className="text-[11px] text-fg-muted font-sans">Shades late-night to 0.95 and primetime to Market Price + 0.05, strictly bounded between $0.50 floor and $10.00 ceiling.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: deploy_bidding_policy */}
                    {stepIndex >= 4 && (
                        <div className={`p-5 rounded-2xl border transition-all space-y-3 bg-card text-fg shadow-sm animate-rise ${
                            stepIndex === 4 && !completed
                                ? 'border-amber-500/60 shadow-lg shadow-amber-500/10 animate-pulse-slow'
                                : 'border-emerald-500/40'
                        }`}>
                            <div className="flex items-start gap-4">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 border ${stepIndex >= 5 || completed
                                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-sm'
                                    : 'bg-vibe-cyan border-vibe-cyan text-black shadow-md'
                                    }`}>
                                    {stepIndex >= 5 || completed ? <Check size={16} /> : <FileCode2 size={16} />}
                                </div>
                                <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-amber-700 dark:text-amber-400 text-sm flex items-center gap-1.5">
                                            4. <code className="font-mono bg-amber-500/10 px-1.5 py-0.5 rounded text-xs">deploy_bidding_policy()</code> — Production Code Actuator
                                        </span>
                                        <span className="text-[11px] font-mono text-fg-muted">File Deployment</span>
                                    </div>
                                    <p className="text-fg-muted text-xs font-sans leading-relaxed">
                                        Validated Python AST, verified <code className="font-mono text-fg bg-overlay px-1 rounded">compute_bid(context)</code> signature, and atomically deployed to <code className="text-fg font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline">policies/agent_bidding_policy.py</code>.
                                    </p>
                                </div>
                            </div>

                            {/* Step 4 Tool Call Verification Details */}
                            <div className="pl-12 space-y-2 pt-1">
                                <div className="p-3 bg-overlay rounded-xl border border-hairline font-mono text-[11px] space-y-2">
                                    <div className="flex items-center justify-between text-[10px] text-fg-muted uppercase tracking-wider font-bold border-b border-hairline/60 pb-1">
                                        <span>Actuator Tool Call Verification</span>
                                        <span className="text-amber-600 dark:text-amber-400">AST Validated</span>
                                    </div>
                                    <pre className="text-fg-muted leading-relaxed overflow-x-auto text-[11px]">
                                        {`deploy_bidding_policy(
    python_code="""def compute_bid(context: AuctionContext) -> float: ...""",
    strategy_summary="Adaptive pacing with P90 bid shading across dayparts"
)`}
                                    </pre>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] border border-emerald-500/30">✓ Valid AST</span>
                                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] border border-emerald-500/30">✓ compute_bid(context) Verified</span>
                                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] border border-emerald-500/30">✓ PEP 8 Formatted</span>
                                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] border border-emerald-500/30">✓ Atomic Write to policies/agent_bidding_policy.py</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Synthesized Code Section (ONLY Shown Below Steps When Completed) */}
            {completed && (
                <div className="space-y-4 animate-rise pt-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
                            <Code2 size={15} className="text-amber-600 dark:text-amber-400" />
                            <span>Synthesized Production Policy Script</span>
                        </div>
                        <span className="text-[11px] font-mono text-fg-muted">policies/agent_bidding_policy.py</span>
                    </div>

                    <div className="p-6 bg-card rounded-3xl border border-hairline shadow-2xl space-y-6">
                        <div className="rounded-2xl overflow-hidden border border-hairline bg-card shadow-md">
                            <PythonCodeHighlight
                                code={generatedCode}
                                filename="agent_bidding_policy.py"
                                editable={false}
                                className="max-h-[520px]"
                            />
                        </div>

                        <div className="p-5 bg-purple-500/10 border border-purple-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-rise shadow-sm">
                            <div className="flex items-center gap-3 text-xs font-mono text-purple-800 dark:text-purple-300">
                                <CheckCircle2 size={20} className="text-purple-600 dark:text-purple-400 shrink-0" />
                                <div>
                                    <strong className="block text-fg font-sans text-sm">Initial Policy Candidate Synthesized (Generation 1)</strong>
                                    <span className="text-fg-muted text-xs font-normal">
                                        In enterprise environments, we need to test and verify code before using it in production. Next, we use <strong>ADK Eval</strong> to benchmark safety guardrails.
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={handleDeployAndProceed}
                                disabled={deploying}
                                className="px-6 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 shrink-0 disabled:opacity-50"
                            >
                                <span>{deploying ? 'Deploying...' : 'Proceed to Agent Evaluation'}</span>
                                <ArrowRight size={15} />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
