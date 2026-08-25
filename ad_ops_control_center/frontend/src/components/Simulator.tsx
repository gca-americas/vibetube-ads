import { useState, useEffect, useRef } from 'react';
import { Play, FastForward, Eye, Wallet, RotateCcw, Zap, Loader2, ArrowRight } from 'lucide-react';

interface ChartPoint {
  auctionCount: number;
  rivalP90: number;
  campaignBid: number;
  phase: 'normal' | 'spike' | 'dropout';
}

interface ActiveSimState {
  active: boolean;
  phase: 'normal' | 'spike' | 'dropout';
  phaseNumber: number;
  phaseName: string;
  processed: number;
  target: number;
  wins: number;
  cost: number;
  overspend: number;
  budgetRemaining: number;
}

export interface MarketZone {
  start: number;
  end: number;
  timeRange: string;
  name: string;
  badge: string;
  color: string;
  bg: string;
  description: string;
}

export const MARKET_ZONES: MarketZone[] = [
  {
    start: 0,
    end: 250000,
    timeRange: '00:00 – 06:00',
    name: 'Late-Night Cooldown',
    badge: '🌙 Late Night',
    color: 'text-blue-400',
    bg: 'rgba(59, 130, 246, 0.05)',
    description: 'Off-peak clearing floor ($0.85 – $0.95 CPM). Shading bids protects liquidity.',
  },
  {
    start: 250000,
    end: 500000,
    timeRange: '06:00 – 12:00',
    name: 'Morning & Lunch Rush',
    badge: '☀️ Morning / Lunch',
    color: 'text-emerald-400',
    bg: 'rgba(16, 185, 129, 0.05)',
    description: 'Baseline viewer flow ($2.40 CPM) with lunch demand peak ($4.20 CPM).',
  },
  {
    start: 500000,
    end: 710000,
    timeRange: '12:00 – 17:00',
    name: '⚔️ Bidding War & Pop',
    badge: '⚔️ Bidding War',
    color: 'text-amber-400',
    bg: 'rgba(245, 158, 11, 0.07)',
    description: 'Rival bot ramp ($3.50 ➔ $9.20), budget exhaustion, and flash drop to $1.80.',
  },
  {
    start: 710000,
    end: 920000,
    timeRange: '17:00 – 22:00',
    name: '⚡ Primetime Surge',
    badge: '⚡ Primetime',
    color: 'text-red-400',
    bg: 'rgba(239, 68, 68, 0.08)',
    description: 'Peak organic audience traffic ($9.60 CPM clearing floor).',
  },
  {
    start: 920000,
    end: 1000000,
    timeRange: '22:00 – 24:00',
    name: '🌙 Wind-Down',
    badge: '🌙 Wind-Down',
    color: 'text-blue-400',
    bg: 'rgba(59, 130, 246, 0.05)',
    description: 'Market returns to overnight floor ($0.90 CPM). Pacing completion.',
  },
];

export function get24HourExpectedP90(step: number, totalSteps = 50): { p90: number; phase: 'normal' | 'spike' | 'dropout'; name: string; hour: string } {
  const t = (step / totalSteps) * 24.0; // 0.0 to 24.0
  const hourInt = Math.floor(t);
  const minInt = Math.floor((t - hourInt) * 60);
  const hourStr = `${hourInt.toString().padStart(2, '0')}:${minInt.toString().padStart(2, '0')}`;

  if (t < 6.0) {
    const base = 0.85 + 0.10 * Math.sin(t);
    return { p90: Number(base.toFixed(2)), phase: 'dropout', name: `Late-Night Cooldown 🌙 (${hourStr}) · ~$${base.toFixed(2)} CPM`, hour: hourStr };
  } else if (t < 11.0) {
    const base = 1.40 + (t - 6.0) * 0.22;
    return { p90: Number(base.toFixed(2)), phase: 'normal', name: `Morning Flow ☀️ (${hourStr}) · ~$${base.toFixed(2)} CPM`, hour: hourStr };
  } else if (t < 13.5) {
    const base = 3.80 + 0.50 * Math.sin(((t - 11.0) * Math.PI) / 2.5);
    return { p90: Number(base.toFixed(2)), phase: 'spike', name: `Lunch Rush Peak 🥪 (${hourStr}) · ~$${base.toFixed(2)} CPM`, hour: hourStr };
  } else if (t < 14.5) {
    return { p90: 2.60, phase: 'normal', name: `Afternoon Baseline (${hourStr}) · ~$2.60 CPM`, hour: hourStr };
  } else if (t < 16.5) {
    const progress = (t - 14.5) / 2.0;
    const base = 3.50 + progress * 5.70;
    return { p90: Number(base.toFixed(2)), phase: 'spike', name: `⚔️ Bidding War Escalation (${hourStr}) · ~$${base.toFixed(2)} CPM`, hour: hourStr };
  } else if (t < 17.5) {
    return { p90: 1.80, phase: 'dropout', name: `💥 Post-War Market Crash (${hourStr}) · ~$1.80 CPM`, hour: hourStr };
  } else if (t < 22.0) {
    const base = 9.40 + 0.25 * Math.sin(t);
    return { p90: Number(base.toFixed(2)), phase: 'spike', name: `⚡ Primetime Peak Audience (${hourStr}) · ~$${base.toFixed(2)} CPM`, hour: hourStr };
  } else {
    const progress = (t - 22.0) / 2.0;
    const base = Math.max(0.90, 9.40 - progress * 8.50);
    return { p90: Number(base.toFixed(2)), phase: 'dropout', name: `🌙 Night Wind-Down (${hourStr}) · ~$${base.toFixed(2)} CPM`, hour: hourStr };
  }
}

export default function Simulator({ 
  navigate,
  activeLab,
  attempt = 1
}: { 
  navigate?: (v: string) => void; 
  activeLab?: string;
  attempt?: 1 | 2 | 3;
}) {
  const [campaignState, setCampaignState] = useState<any>(null);
  const [policyCode, setPolicyCode] = useState<string>('');
  
  // Real-time chart telemetry points across 1,000,000 auctions
  const [chartData, setChartData] = useState<ChartPoint[]>([
    { auctionCount: 0, rivalP90: 0.85, campaignBid: 2.50, phase: 'dropout' }
  ]);

  // Interactive Hover Scrubber State
  const [hoveredPoint, setHoveredPoint] = useState<ChartPoint | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);

  // Unified Simulation State (1,000,000 Auctions Total across 50 ticks of 20,000)
  const [simState, setSimState] = useState<ActiveSimState>({
    active: false,
    phase: 'dropout',
    phaseNumber: 1,
    phaseName: 'Late-Night Cooldown',
    processed: 0,
    target: 1000000,
    wins: 0,
    cost: 0,
    overspend: 0,
    budgetRemaining: 2500.0,
  });

  const fastForwardRef = useRef<boolean>(false);

  useEffect(() => {
    fetchState();
    fetchActivePolicy();
    return () => {
      fastForwardRef.current = false;
    };
  }, [activeLab, attempt]);

  const fetchActivePolicy = async () => {
    try {
      const res = await fetch('/campaign/script');
      if (res.ok) {
        const data = await res.json();
        if (data.script) {
          setPolicyCode(data.script);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch active policy script:', e);
    }
  };

  const fetchState = async () => {
    try {
      const res = await fetch('/campaign/config');
      if (res.ok) {
        const data = await res.json();
        setCampaignState(data);
        // Initialize starting point with actual campaign base bid
        if (data.base_bid_cpm || data.active_bid_cpm) {
          const startingBid = data.base_bid_cpm ?? 2.50;
          setChartData(prev => {
            if (prev.length === 1 && prev[0].auctionCount === 0) {
              return [{ ...prev[0], campaignBid: startingBid }];
            }
            return prev;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to fetch campaign config:', e);
    }
  };

  // Reset Simulation to Initial State
  const resetSimulation = async () => {
    fastForwardRef.current = false;
    const startingBid = campaignState?.base_bid_cpm ?? 2.50;
    const startPoint = get24HourExpectedP90(0, 50);
    setChartData([
      { auctionCount: 0, rivalP90: startPoint.p90, campaignBid: startingBid, phase: startPoint.phase }
    ]);
    setSimState({
      active: false,
      phase: startPoint.phase,
      phaseNumber: 1,
      phaseName: 'Late-Night Cooldown',
      processed: 0,
      target: 1000000,
      wins: 0,
      cost: 0,
      overspend: 0,
      budgetRemaining: campaignState?.total_budget ?? 2500.0,
    });
    fetch('/simulation/reset', { method: 'POST' }).catch(() => {});
  };

  // Smooth Full-Flight Simulation (1,000,000 auctions across 24 hours)
  const runFullSimulation = async () => {
    if (simState.active) return;

    fastForwardRef.current = false;

    // Reset ad server state in background
    fetch('/simulation/reset', { method: 'POST' }).catch(() => {});

    // Strip docstrings and comments to inspect only actual executable code
    const codeOnly = policyCode
      .replace(/"""[\s\S]*?"""/g, '')
      .replace(/'''[\s\S]*?'''/g, '')
      .replace(/#.*$/gm, '')
      .trim();

    // For Attempt 1, strictly enforce baseline flat bid
    // For Attempt 2, enforce heuristic or detect
    // For Attempt 3, enforce AI optimized
    const isOptimized = attempt === 3 || (attempt !== 1 && (codeOnly.includes('recent_p90_cpm') || codeOnly.includes('p90_history') || codeOnly.includes('velocity')));
    const isHandCoded = attempt === 2 || (attempt !== 1 && !isOptimized && (codeOnly.includes('daypart') || codeOnly.includes('primetime') || codeOnly.includes('late_night')));

    // Ensure we have freshest config
    const initialBid = campaignState?.base_bid_cpm && campaignState.base_bid_cpm > 0 
      ? campaignState.base_bid_cpm 
      : 2.50;
    const ceiling = campaignState?.max_bid_ceiling || 10.00;
    let currentBudget = campaignState?.total_budget ?? 2500.0;
    let totalWins = 0;
    let totalCost = 0;
    let totalOverspend = 0;

    const totalTarget = 1000000;
    const numSteps = 50; // 50 ticks of 20,000 auctions across 24 hours
    const auctionsPerStep = 20000;

    // Instantly reset chart points with starting point for 00:00 without delay
    const startPoint = get24HourExpectedP90(0, numSteps);
    const points: ChartPoint[] = [
      { auctionCount: 0, rivalP90: startPoint.p90, campaignBid: initialBid, phase: startPoint.phase }
    ];
    setChartData(points);

    setSimState({
      active: true,
      phase: startPoint.phase,
      phaseNumber: 1,
      phaseName: startPoint.name,
      processed: 0,
      target: totalTarget,
      wins: 0,
      cost: 0,
      overspend: 0,
      budgetRemaining: currentBudget,
    });

    for (let step = 0; step < numSteps; step++) {
      const { p90: expectedRivalP90, phase: currentPhase, name: phaseName } = get24HourExpectedP90(step, numSteps);
      const t = (step / numSteps) * 24.0;
      
      let liveBid = initialBid;
      if (isOptimized) {
        // Multi-Daypart AI-Optimized Adaptive Policy (Momentum + Shading + Ceiling)
        if (t < 6.0) {
          liveBid = 0.90;
        } else if (t < 11.0) {
          liveBid = Math.min(expectedRivalP90 + 0.05, ceiling);
        } else if (t < 13.5) {
          liveBid = Math.min(expectedRivalP90 + 0.05, ceiling);
        } else if (t < 14.5) {
          liveBid = Math.min(2.65, ceiling);
        } else if (t < 16.5) {
          // Bidding War escalation
          liveBid = Math.min(expectedRivalP90 + 0.05, ceiling);
        } else if (t < 17.5) {
          // Post-war crash
          liveBid = 0.90;
        } else if (t < 22.0) {
          // Primetime peak
          liveBid = Math.min(9.65, ceiling);
        } else {
          liveBid = 0.90;
        }
      } else if (isHandCoded) {
        // Hand-Coded Dayparts Heuristic (Static blocks)
        if (t < 6.0 || t >= 22.0) {
          liveBid = 0.90;
        } else if (t >= 17.0 && t < 22.0) {
          liveBid = Math.min(9.65, ceiling);
        } else if (t >= 11.0 && t < 17.0) {
          liveBid = 3.55;
        } else {
          liveBid = 2.40;
        }
      } else {
        // Baseline Heuristic Rule: Fixed flat $2.50
        liveBid = initialBid;
      }

      liveBid = Number(liveBid.toFixed(2));

      // If budget is already exhausted, effective bid is $0.00
      let effectiveBid = currentBudget > 0 ? liveBid : 0.0;

      // Calculate step outcomes based on real economic bid vs market floor
      // Steep power falloff (x^4.0) so bidding far below P90 drains budget very slowly
      const ratio = expectedRivalP90 > 0 ? effectiveBid / expectedRivalP90 : 0;
      const winProb = effectiveBid <= 0 
        ? 0 
        : effectiveBid >= expectedRivalP90 
          ? 0.94 
          : Math.max(0.001, 0.90 * Math.pow(ratio, 4.0));
      
      let stepWins = Math.round(auctionsPerStep * winProb);
      const impCost = effectiveBid / 1000.0;
      let stepCost = stepWins * impCost;

      if (currentBudget <= 0) {
        stepWins = 0;
        stepCost = 0;
        effectiveBid = 0.0;
      } else if (currentBudget < stepCost) {
        stepWins = Math.floor(currentBudget / Math.max(0.0001, impCost));
        stepCost = currentBudget;
        currentBudget = 0;
      } else {
        currentBudget = Math.round((currentBudget - stepCost) * 10000) / 10000;
      }

      // Overspend: amount paid above the minimum winning floor
      const stepOverspendCPM = Math.max(0, effectiveBid - (expectedRivalP90 + 0.01));
      const stepOverspend = (stepOverspendCPM / 1000.0) * stepWins;

      totalWins += stepWins;
      totalCost += stepCost;
      totalOverspend += stepOverspend;

      // Execute simulation tick on server in background to populate live BigQuery events
      fetch('/simulation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: 'student-1', 
          numAuctions: auctionsPerStep,
          stepIndex: step,
          bid_cpm: effectiveBid,
        }),
      }).catch(() => {});

      const processedCount = (step + 1) * auctionsPerStep;
      points.push({
        auctionCount: processedCount,
        rivalP90: expectedRivalP90,
        campaignBid: effectiveBid,
        phase: currentPhase,
      });
      setChartData([...points]);

      setSimState({
        active: true,
        phase: currentPhase,
        phaseNumber: step + 1,
        phaseName,
        processed: processedCount,
        target: totalTarget,
        wins: totalWins,
        cost: totalCost,
        overspend: totalOverspend,
        budgetRemaining: currentBudget,
      });

      // Smooth animation delay (~7.5s total flight time, fast-forward available)
      if (step < numSteps - 1 && !fastForwardRef.current) {
        await new Promise(r => setTimeout(r, 150));
      }
    }

    setSimState(prev => ({ ...prev, active: false, processed: totalTarget }));
    await fetchState();
  };

  const fastForward = () => {
    fastForwardRef.current = true;
  };

  const latestPoint = chartData[chartData.length - 1] || chartData[0];
  const maxBidCeiling = campaignState?.max_bid_ceiling ?? 10.00;
  const avgCPM = simState.wins > 0 ? ((simState.cost / simState.wins) * 1000.0) : (campaignState?.base_bid_cpm ?? 2.50);

  // Budget Remaining Threshold Colors: > $1000 -> Red, > $100 -> Yellow, <= $100 -> Green
  const budgetRemainingColor = simState.processed > 0 
    ? (simState.budgetRemaining > 1000 ? 'text-red-400' : simState.budgetRemaining > 100 ? 'text-amber-400' : 'text-emerald-400')
    : 'text-fg-muted';

  const budgetRemainingBadge = simState.processed > 0
    ? (simState.budgetRemaining > 1000 ? 'bg-red-500/15 border-red-500/30 text-red-400 font-bold' : simState.budgetRemaining > 100 ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 font-bold' : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400 font-bold')
    : 'bg-card border-hairline text-fg-muted';

  // SVG Chart Geometry Constants (viewBox 0 0 800 240)
  const chartW = 800;
  const chartH = 240;
  const padLeft = 60;
  const padRight = 35;
  const padTop = 32;
  const padBottom = 26;
  const innerW = chartW - padLeft - padRight;
  const innerH = chartH - padTop - padBottom;
  const maxAuctions = 1000000;
  const maxCPM = 12.0;

  const getX = (auctions: number) => padLeft + (Math.min(maxAuctions, auctions) / maxAuctions) * innerW;
  const getY = (cpm: number) => padTop + innerH - (Math.min(maxCPM, Math.max(0, cpm)) / maxCPM) * innerH;

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgX = (clientX / rect.width) * chartW;

    if (svgX < padLeft || svgX > chartW - padRight || chartData.length === 0) {
      setHoveredPoint(null);
      setHoverX(null);
      return;
    }

    const auctionsRatio = Math.max(0, Math.min(1, (svgX - padLeft) / innerW));
    const targetAuctions = auctionsRatio * maxAuctions;

    let closest = chartData[0];
    let minDiff = Math.abs(closest.auctionCount - targetAuctions);
    for (let i = 1; i < chartData.length; i++) {
      const diff = Math.abs(chartData[i].auctionCount - targetAuctions);
      if (diff < minDiff) {
        minDiff = diff;
        closest = chartData[i];
      }
    }

    setHoveredPoint(closest);
    setHoverX(getX(closest.auctionCount));
  };

  const handleSvgMouseLeave = () => {
    setHoveredPoint(null);
    setHoverX(null);
  };

  // Build SVG path strings
  const rivalPath = chartData.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(pt.auctionCount)} ${getY(pt.rivalP90)}`).join(' ');
  const campaignPath = chartData.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(pt.auctionCount)} ${getY(pt.campaignBid)}`).join(' ');
  const ceilingPath = `M ${getX(0)} ${getY(maxBidCeiling)} L ${getX(maxAuctions)} ${getY(maxBidCeiling)}`;

  // Meta info by attempt
  const stepNumber = attempt === 1 ? 2 : attempt === 2 ? 4 : 6;
  const title = attempt === 1 
    ? 'Attempt 1: Baseline Simulation' 
    : attempt === 2 
      ? 'Attempt 2: Heuristic Simulation' 
      : 'Attempt 3: Agentic Simulation';
  const subtitle = attempt === 1
    ? 'Evaluates a static $2.50 CPM flat bid with no dynamic policy against 24-hour market clearing dynamics.'
    : attempt === 2
      ? 'Evaluates hand-coded Python daypart rules against volatility, afternoon bidding wars, and competitor dropouts.'
      : 'Evaluates ADK 2.0 & Gemini-authored adaptive policy with real-time momentum tracking and dynamic spend pacing.';
  const nextTarget = attempt === 1 ? 'manual_policy' : attempt === 2 ? 'ai_engineer' : 'scorecard';
  const nextLabel = attempt === 1 
    ? 'Proceed to Step 3: Manual Policy' 
    : attempt === 2 
      ? 'Proceed to Step 5: AI Data Engineer' 
      : 'Proceed to Step 7: Final Scorecard';

  return (
    <div className="animate-rise pb-24 space-y-8">
      {/* Page Header with Attempt Identification and Actions */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider bg-overlay border border-hairline text-vibe-cyan">
              Step {stepNumber} of 7
            </span>
            <span className="text-xs font-mono text-fg-muted">
              {attempt === 1 && 'Baseline Flight (Flat Bid)'}
              {attempt === 2 && 'Rule-Based Flight (Dayparts)'}
              {attempt === 3 && 'Autonomous Flight (AI Agent)'}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold text-fg">{title}</h1>
          <p className="text-xs sm:text-sm text-fg-muted mt-1 max-w-2xl">{subtitle}</p>
        </div>

        {/* Simulation Controls */}
        <div className="flex items-center gap-3">
          {simState.processed > 0 && !simState.active && (
            <button
              onClick={resetSimulation}
              className="px-5 py-3 bg-overlay hover:bg-hairline text-fg font-medium rounded-2xl text-xs border border-hairline transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} /> Reset Simulation
            </button>
          )}

          {simState.processed > 0 && !simState.active ? (
            <button
              onClick={() => navigate?.(nextTarget)}
              className="px-7 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold rounded-2xl text-xs transition-all shadow-lg hover:shadow-vibe-cyan/20 flex items-center gap-2 cursor-pointer"
            >
              {nextLabel} <ArrowRight size={16} />
            </button>
          ) : (
            <button
              onClick={() => runFullSimulation()}
              disabled={simState.active}
              className="px-7 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold rounded-2xl text-xs transition-all shadow-lg hover:shadow-vibe-cyan/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {simState.active ? (
                <>
                  <Loader2 size={16} className="animate-spin" /> Simulating Auctions...
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" /> 📈 Launch Simulation
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Unified 24-Hour Auction Simulator Centerpiece Container */}
      <div className="p-7 bg-card rounded-3xl border border-hairline shadow-2xl space-y-5">
        {/* 1. Core Ad Tech Formula: Spend / Impressions = Avg CPM */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2.5">
          {/* Box 1: Budget Spent (Cost) */}
          <div className="flex-1 p-5 bg-overlay border border-hairline rounded-2xl space-y-1.5 transition-all">
            <div className="flex items-center justify-between text-fg-muted">
              <span className="text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Wallet size={15} className="text-emerald-400" /> Total Spend
              </span>
              <span className={`text-xs font-mono px-2 py-0.5 rounded-full border transition-all ${budgetRemainingBadge}`}>
                ${simState.budgetRemaining.toFixed(2)} left
              </span>
            </div>
            <div className="text-3xl font-display font-bold text-fg tracking-tight">
              ${simState.cost.toFixed(2)}
            </div>
            <p className="text-xs text-fg-muted font-mono">
              {simState.cost > 0 ? (
                <span>
                  <strong className={`font-bold ${budgetRemainingColor}`}>${simState.budgetRemaining.toFixed(2)} remaining</strong> of $2,500 budget
                </span>
              ) : (
                '$2,500.00 total campaign liquidity'
              )}
            </p>
          </div>

          {/* Division Operator: / */}
          <div className="hidden md:flex items-center justify-center text-fg-muted font-mono text-2xl font-bold opacity-50 px-1 select-none">
            /
          </div>

          {/* Box 2: Impressions Won */}
          <div className="flex-1 p-5 bg-overlay border border-hairline rounded-2xl space-y-1.5 transition-all">
            <div className="flex items-center justify-between text-fg-muted">
              <span className="text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Eye size={15} className="text-vibe-cyan" /> Impressions Won
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-card border border-hairline text-fg-muted">
                {simState.processed > 0 ? `${((simState.wins / simState.processed) * 100).toFixed(1)}% reach` : '1M capacity'}
              </span>
            </div>
            <div className="text-3xl font-display font-bold text-fg tracking-tight">
              {simState.wins.toLocaleString()}
            </div>
            <p className="text-xs text-fg-muted font-mono">
              {simState.processed > 0 
                ? `${simState.wins.toLocaleString()} of ${simState.processed.toLocaleString()} auctions won`
                : '1,000,000 auctions across 24-hour flight'}
            </p>
          </div>

          {/* Equals Operator: = */}
          <div className="hidden md:flex items-center justify-center text-fg-muted font-mono text-2xl font-bold opacity-50 px-1 select-none">
            =
          </div>

          {/* Box 3: Average Cost Per Mille (Avg CPM) */}
          <div className="flex-1 p-5 bg-overlay border border-hairline rounded-2xl space-y-1.5 transition-all">
            <div className="flex items-center justify-between text-fg-muted">
              <span className="text-xs uppercase tracking-wider font-semibold flex items-center gap-1.5">
                <Zap size={15} className="text-amber-400" /> Avg Cost (CPM)
              </span>
              <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-card border border-hairline text-fg-muted">
                per 1k imps
              </span>
            </div>
            <div className="text-3xl font-display font-bold text-amber-400 tracking-tight">
              ${avgCPM.toFixed(2)}
            </div>
            <p className="text-xs text-fg-muted font-mono">
              {simState.wins > 0 
                ? `Effective clearing price per 1,000 impressions` 
                : 'Base bid: $2.50 CPM'}
            </p>
          </div>
        </div>

        {/* 2. The SVG Real-Time Time Series Diagram */}
        <div className="relative bg-overlay rounded-2xl border border-hairline p-4 overflow-hidden">
          <svg 
            viewBox={`0 0 ${chartW} ${chartH}`} 
            className="w-full h-auto overflow-visible select-none cursor-crosshair"
            onMouseMove={handleSvgMouseMove}
            onMouseLeave={handleSvgMouseLeave}
          >
            {/* Dynamic Market Zone Background Shading & Vertical Separators */}
            {MARKET_ZONES.map((zone, idx) => (
              <g key={zone.name}>
                <rect 
                  x={getX(zone.start)} 
                  y={padTop} 
                  width={getX(zone.end) - getX(zone.start)} 
                  height={innerH} 
                  fill={zone.bg} 
                />
                {idx > 0 && (
                  <line 
                    x1={getX(zone.start)} 
                    y1={padTop} 
                    x2={getX(zone.start)} 
                    y2={padTop + innerH} 
                    stroke="currentColor" 
                    strokeDasharray="4 4" 
                    className="text-hairline opacity-40" 
                  />
                )}
              </g>
            ))}

            {/* Horizontal Grid Lines & Y-Axis Scale ($0, $3, $6, $9, $12) */}
            {[0, 3, 6, 9, 12].map(val => (
              <g key={val}>
                <line 
                  x1={padLeft} 
                  y1={getY(val)} 
                  x2={chartW - padRight} 
                  y2={getY(val)} 
                  stroke="currentColor" 
                  className="text-hairline opacity-40" 
                />
                <text 
                  x={padLeft - 10} 
                  y={getY(val) + 4} 
                  textAnchor="end" 
                  className="fill-fg-muted text-[10px] font-mono"
                >
                  ${val}
                </text>
              </g>
            ))}

            {/* Vertical Grid Ticks (Time of Day: 00:00, 06:00, 12:00, 18:00, 24:00) */}
            {[
              { count: 0, time: '00:00' },
              { count: 250000, time: '06:00' },
              { count: 500000, time: '12:00' },
              { count: 750000, time: '18:00' },
              { count: 1000000, time: '24:00' },
            ].map(tick => (
              <g key={tick.count}>
                <line 
                  x1={getX(tick.count)} 
                  y1={padTop + innerH} 
                  x2={getX(tick.count)} 
                  y2={padTop + innerH + 5} 
                  stroke="currentColor" 
                  className="text-hairline" 
                />
                <text 
                  x={getX(tick.count)} 
                  y={padTop + innerH + 16} 
                  textAnchor="middle" 
                  className="fill-fg text-[10px] font-mono font-bold"
                >
                  {tick.time}
                </text>
              </g>
            ))}

            {/* Line 0: Max Bid Ceiling Guardrail Line ($10.00 CPM) */}
            <path 
              d={ceilingPath} 
              fill="none" 
              stroke="#38bdf8" 
              strokeWidth="1.5" 
              strokeDasharray="6 4"
              className="opacity-70 drop-shadow-[0_0_6px_rgba(56,189,248,0.4)]" 
            />
            <text 
              x={chartW - padRight} 
              y={getY(maxBidCeiling) - 5} 
              textAnchor="end" 
              className="fill-sky-400 text-[9px] font-mono font-bold uppercase tracking-wider opacity-85"
            >
              Max Bid Ceiling (${maxBidCeiling.toFixed(2)} CPM)
            </text>

            {/* Line 1: Minimum-to-Win Price */}
            <path 
              d={rivalPath} 
              fill="none" 
              stroke="#fb7185" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="transition-all duration-200 drop-shadow-[0_0_8px_rgba(244,63,94,0.7)]" 
            />

            {/* Line 2: Active Campaign Bid */}
            <path 
              d={campaignPath} 
              fill="none" 
              stroke="#2dd4bf" 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              className="transition-all duration-200 drop-shadow-[0_0_8px_rgba(45,212,191,0.8)]" 
            />

            {/* Pulsing Dots & Leading Edge Price Callout Pills (Active & Final) */}
            {chartData.length > 0 && (() => {
              const cx = getX(latestPoint.auctionCount);
              const cyCampaign = getY(latestPoint.campaignBid);
              const cyRival = getY(latestPoint.rivalP90);
              const isRightEdge = latestPoint.auctionCount >= 500000;
              const pillOffsetX = isRightEdge ? -56 : 10;
              
              const isClose = Math.abs(cyCampaign - cyRival) < 22;
              const campaignPillY = isClose && cyCampaign >= cyRival ? cyCampaign + 5 : cyCampaign - 10;
              const rivalPillY = isClose && cyRival > cyCampaign ? cyRival + 5 : cyRival - 10;

              return (
                <>
                  {/* Min-to-Win Leading Pin */}
                  <circle 
                    cx={cx} 
                    cy={cyRival} 
                    r="5" 
                    fill="#fb7185" 
                    className="animate-pulse shadow-lg"
                  />
                  {/* Campaign Leading Pin */}
                  <circle 
                    cx={cx} 
                    cy={cyCampaign} 
                    r="5" 
                    fill="#2dd4bf" 
                    className="animate-pulse shadow-lg"
                  />

                  {/* Min-to-Win Price Pill Badge */}
                  <g transform={`translate(${cx + pillOffsetX}, ${rivalPillY})`} className="pointer-events-none transition-all duration-150">
                    <rect
                      x="0"
                      y="0"
                      width="46"
                      height="17"
                      rx="5"
                      fill="#0f0f18"
                      stroke="#fb7185"
                      strokeWidth="1.2"
                      className="shadow-lg"
                    />
                    <text
                      x="23"
                      y="12"
                      textAnchor="middle"
                      fill="#fb7185"
                      className="text-[9px] font-mono font-bold select-none"
                    >
                      ${latestPoint.rivalP90.toFixed(2)}
                    </text>
                  </g>

                  {/* Active Campaign Bid Pill Badge */}
                  <g transform={`translate(${cx + pillOffsetX}, ${campaignPillY})`} className="pointer-events-none transition-all duration-150">
                    <rect
                      x="0"
                      y="0"
                      width="46"
                      height="17"
                      rx="5"
                      fill="#0f0f18"
                      stroke="#2dd4bf"
                      strokeWidth="1.2"
                      className="shadow-lg"
                    />
                    <text
                      x="23"
                      y="12"
                      textAnchor="middle"
                      fill="#2dd4bf"
                      className="text-[9px] font-mono font-bold select-none"
                    >
                      ${latestPoint.campaignBid.toFixed(2)}
                    </text>
                  </g>
                </>
              );
            })()}

            {/* Interactive Hover Scrubber Line & Rich Tooltip */}
            {hoveredPoint && hoverX !== null && (() => {
              const isRightSide = hoveredPoint.auctionCount > 500000;
              const tooltipX = isRightSide ? hoverX - 170 : hoverX + 12;
              const tooltipY = padTop + 6;
              const isOutOfBudget = hoveredPoint.campaignBid === 0;
              const isWinning = !isOutOfBudget && hoveredPoint.campaignBid >= hoveredPoint.rivalP90;

              return (
                <g className="pointer-events-none transition-all duration-75">
                  {/* Vertical Scrubber Line */}
                  <line
                    x1={hoverX}
                    y1={padTop}
                    x2={hoverX}
                    y2={padTop + innerH}
                    stroke="rgba(255, 255, 255, 0.4)"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />

                  {/* Target Points on Lines */}
                  <circle
                    cx={hoverX}
                    cy={getY(hoveredPoint.rivalP90)}
                    r="5"
                    fill="#fb7185"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="drop-shadow-[0_0_8px_#fb7185]"
                  />
                  <circle
                    cx={hoverX}
                    cy={getY(hoveredPoint.campaignBid)}
                    r="5"
                    fill={isOutOfBudget ? '#94a3b8' : '#2dd4bf'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className={isOutOfBudget ? 'drop-shadow-[0_0_8px_#94a3b8]' : 'drop-shadow-[0_0_8px_#2dd4bf]'}
                  />

                  {/* Rich Floating Tooltip */}
                  <g transform={`translate(${tooltipX}, ${tooltipY})`}>
                    <rect
                      x="0"
                      y="0"
                      width="158"
                      height="82"
                      rx="10"
                      fill="#09090f"
                      stroke="rgba(255, 255, 255, 0.15)"
                      strokeWidth="1"
                      className="shadow-2xl"
                    />

                    {/* Tooltip Header: Auction Count & Status */}
                    <text x="10" y="16" fill="#94a3b8" className="text-[9px] font-mono uppercase tracking-wider">
                      {hoveredPoint.auctionCount.toLocaleString()} Auctions
                    </text>
                    <text
                      x="148"
                      y="16"
                      textAnchor="end"
                      fill={isOutOfBudget ? '#94a3b8' : isWinning ? '#34d399' : '#f87171'}
                      className="text-[9px] font-bold font-mono"
                    >
                      {isOutOfBudget ? '✗ EXHAUSTED' : isWinning ? '✓ WINNING' : '✗ OUTBID'}
                    </text>

                    <line x1="10" y1="23" x2="148" y2="23" stroke="rgba(255, 255, 255, 0.1)" />

                    {/* Active Bid Value */}
                    <circle cx="14" cy="37" r="3" fill={isOutOfBudget ? '#94a3b8' : '#2dd4bf'} />
                    <text x="22" y="40" fill="#94a3b8" className="text-[10px] font-mono">Active Bid:</text>
                    <text x="148" y="40" textAnchor="end" fill={isOutOfBudget ? '#94a3b8' : '#2dd4bf'} className="text-[10px] font-mono font-bold">
                      {isOutOfBudget ? '$0.00 (Exhausted)' : `$${hoveredPoint.campaignBid.toFixed(2)} CPM`}
                    </text>

                    {/* Min-to-Win Value */}
                    <circle cx="14" cy="54" r="3" fill="#fb7185" />
                    <text x="22" y="57" fill="#94a3b8" className="text-[10px] font-mono">Min-to-Win:</text>
                    <text x="148" y="57" textAnchor="end" fill="#fb7185" className="text-[10px] font-mono font-bold">
                      ${hoveredPoint.rivalP90.toFixed(2)} CPM
                    </text>

                    {/* Max Ceiling Value */}
                    <circle cx="14" cy="71" r="3" fill="#38bdf8" />
                    <text x="22" y="74" fill="#94a3b8" className="text-[10px] font-mono">Max Ceiling:</text>
                    <text x="148" y="74" textAnchor="end" fill="#38bdf8" className="text-[10px] font-mono font-bold">
                      ${maxBidCeiling.toFixed(2)} CPM
                    </text>
                  </g>
                </g>
              );
            })()}
          </svg>
        </div>

        {/* Real-time In-Flight Simulation Progress Bar */}
        <div className="p-4 bg-overlay/80 border border-hairline rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${
                simState.active 
                  ? 'bg-vibe-cyan animate-ping' 
                  : simState.processed > 0 
                    ? 'bg-emerald-400' 
                    : 'bg-fg-muted'
              }`} />
              <div>
                <h3 className="text-sm font-bold text-fg flex items-center gap-2">
                  <span>{simState.phaseName}</span>
                </h3>
                <p className="text-xs text-fg-muted font-mono mt-0.5">
                  {simState.active 
                    ? 'Simulating 1,000,000 auctions across 24-hour market day · Streaming live telemetry...' 
                    : simState.processed > 0 
                      ? 'Simulation completed · 1,000,000 auctions evaluated' 
                      : 'Ready for simulation · Click "Launch Simulation" above'}
                </p>
              </div>
            </div>

            {simState.active && (
              <button
                onClick={fastForward}
                className="px-3.5 py-1.5 bg-overlay hover:bg-hairline text-fg font-medium rounded-xl text-xs border border-hairline transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <FastForward size={14} /> Fast-Forward ⏩
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="w-full bg-black/40 rounded-full h-2.5 overflow-hidden border border-hairline">
              <div 
                className="bg-gradient-to-r from-vibe-cyan via-vibe-blue to-vibe-purple h-full transition-all duration-150 ease-out"
                style={{ width: `${(simState.processed / simState.target) * 100}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-[11px] font-mono text-fg-muted">
              <span>{simState.processed.toLocaleString()} / {simState.target.toLocaleString()} Auctions Evaluated</span>
              <span className="text-vibe-cyan font-bold">{Math.round((simState.processed / simState.target) * 100)}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

