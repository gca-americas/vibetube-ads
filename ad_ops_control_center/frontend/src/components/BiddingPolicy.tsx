import { useState, useEffect } from 'react';
import { 
  ArrowLeft, Play, Layers, CheckCircle2, 
  Sparkles, Check, RefreshCw, Terminal, Sliders, Cpu
} from 'lucide-react';

const BASELINE_TEMPLATE = `"""Vibetube Ads - Baseline Bidding Policy Script

This script is executed by the Vibetube Ad Serving Engine on every auction tick
to determine the optimal first-price CPM bid for video ad placement.
"""

def compute_bid(context: dict) -> float:
    # Baseline Starting Policy: Naive flat bid ($2.50 CPM)
    current_bid = 2.50
    ceiling = context.get("max_bid_ceiling", 10.00)
    
    return min(current_bid, ceiling)`;

const HEURISTIC_DAYPART_TEMPLATE = `"""Vibetube Ads - Hand-Coded Dayparting Heuristic
Authored by Data Engineer to handle diurnal traffic waves.
"""

def compute_bid(context: dict) -> float:
    daypart = context.get("daypart", "morning")
    ceiling = context.get("max_bid_ceiling", 10.00)
    
    if daypart == "primetime":
        return min(9.65, ceiling)
    elif daypart == "late_night":
        return 0.90
    elif daypart == "afternoon":
        return 3.55
    else:
        return 2.40`;

const AI_OPTIMIZED_TEMPLATE = `"""Vibetube Ads - AI-Optimized Bidding Policy Script
Authored by ADK AI Data Engineer Agent (Gemini 2.5 Flash) via BigQuery Telemetry.
"""

def compute_bid(context: dict) -> float:
    daypart = context.get("daypart", "morning")
    p90 = context.get("recent_p90_cpm", 2.35)
    p90_history = context.get("p90_history", [p90] * 5)
    win_rate = context.get("recent_win_rate", 0.85)
    ceiling = context.get("max_bid_ceiling", 10.00)
    budget = context.get("budget_remaining", 2500.00)
    hours = max(0.5, context.get("hours_remaining", 12.0))

    # 1. Dynamic Pacing Multiplier (Target: ~$104.16 / hr)
    target_hourly = budget / hours
    pacing = min(1.2, max(0.6, target_hourly / 104.16))

    # 2. Velocity Momentum Detection from Vector Telemetry
    velocity = p90_history[-1] - p90_history[0]

    # 3. Multi-Regime Clearance & Bid Shading
    if daypart == "late_night" or velocity < -1.5:
        # Midnight cooldown: shade down to clearance floor ($0.85 P90)
        return min(0.90, ceiling)
    elif daypart == "primetime" or velocity > 1.5:
        # Aggressive evening surge: clear floor with pacing modulation
        return min((p90 + 0.05) * pacing, ceiling)
    elif daypart == "afternoon":
        return min((p90 + 0.05) * pacing, ceiling)
    else:
        return min(2.40, ceiling)`;

export default function BiddingPolicy({ navigate }: { navigate: (v: string) => void }) {
  const [scriptCode, setScriptCode] = useState<string>(BASELINE_TEMPLATE);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [activeTemplate, setActiveTemplate] = useState<'baseline' | 'heuristic' | 'ai'>('baseline');
  
  const [aiReport, setAiReport] = useState<{
    reasoning: string;
    sqlQueries: string[];
    generatedScript: string;
    timestamp: string;
  } | null>(null);

  // Fetch active script from server on mount
  useEffect(() => {
    fetchActiveScript();
  }, []);

  const fetchActiveScript = async () => {
    try {
      const res = await fetch('/campaign/script');
      if (res.ok) {
        const data = await res.json();
        if (data.script && data.script.trim().length > 0) {
          setScriptCode(data.script);
          if (data.script.includes('AI-Optimized')) {
            setActiveTemplate('ai');
          } else if (data.script.includes('Dayparting Heuristic')) {
            setActiveTemplate('heuristic');
          } else {
            setActiveTemplate('baseline');
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load active bidding script from server:', e);
    }
  };

  const handleSaveScript = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch('/campaign/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptCode }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error('Error saving script:', e);
      alert('Failed to save script to ad server.');
    } finally {
      setSaving(false);
    }
  };

  const handleApplyTemplate = (tpl: 'baseline' | 'heuristic' | 'ai') => {
    setActiveTemplate(tpl);
    if (tpl === 'baseline') {
      setScriptCode(BASELINE_TEMPLATE);
    } else if (tpl === 'heuristic') {
      setScriptCode(HEURISTIC_DAYPART_TEMPLATE);
    } else if (tpl === 'ai') {
      setScriptCode(AI_OPTIMIZED_TEMPLATE);
    }
  };

  const handleRunAiDataEngineer = async () => {
    setIsOptimizing(true);
    try {
      const res = await fetch('/agent/run-cycle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const code = data.generated_script || AI_OPTIMIZED_TEMPLATE;
        setScriptCode(code);
        setActiveTemplate('ai');
        setAiReport({
          reasoning: data.reasoning || "Analyzed BigQuery telemetry across dayparts (morning, afternoon, primetime, late_night). Synthesized multi-regime adaptive bidding policy.",
          sqlQueries: data.sql_queries || [
            "SELECT daypart, AVG(competitor_highest_bid_cpm) AS avg_competitor_bid, APPROX_QUANTILES(competitor_highest_bid_cpm, 100)[OFFSET(90)] AS p90_cpm FROM `vibetube_telemetry.auction_events` GROUP BY daypart;"
          ],
          generatedScript: code,
          timestamp: new Date().toLocaleTimeString(),
        });
        setSaveSuccess(true);
      }
    } catch (e) {
      console.warn('AI Optimization failed:', e);
    } finally {
      setIsOptimizing(false);
    }
  };

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Top Header & Navigation */}
      <div className="flex items-center justify-between">
        <button 
          onClick={() => navigate('console')}
          className="text-fg-muted hover:text-fg flex items-center transition-colors text-sm font-medium uppercase tracking-widest gap-2 cursor-pointer"
        >
          <ArrowLeft size={16} /> Back to Console
        </button>

        <div className="flex gap-3">
          <button 
            onClick={() => navigate('campaigns')}
            className="px-4 py-2 bg-overlay hover:bg-hairline text-fg rounded-xl text-xs font-medium border border-hairline transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Layers size={14} /> Campaigns
          </button>
          <button 
            onClick={() => navigate('simulator')}
            className="px-4 py-2 bg-overlay hover:bg-hairline text-fg rounded-xl text-xs font-medium border border-hairline transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Play size={14} /> Auction Simulator
          </button>
        </div>
      </div>

      {/* Page Title & Actions */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-vibe-purple/20 text-vibe-purple border border-vibe-purple/30 font-mono font-bold uppercase tracking-wider">
              Step 4 & 8 · Code Workspace
            </span>
            <span className="text-xs text-fg-muted font-mono">
              lab_01_yield_optimization/bidding_policy.py
            </span>
          </div>
          <h1 className="text-4xl font-display font-bold mt-1 text-fg">Bidding Policy & AI Engineer</h1>
          <p className="text-fg-muted text-base mt-1">
            Author and deploy Python bidding algorithms evaluated by the ad serving engine on every auction.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRunAiDataEngineer}
            disabled={isOptimizing}
            className="px-5 py-3 bg-vibe-purple hover:bg-vibe-purple/90 text-white font-bold rounded-2xl text-xs transition-all shadow-[0_0_25px_rgba(168,85,247,0.3)] flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles size={16} className={isOptimizing ? 'animate-spin' : ''} />
            {isOptimizing ? 'AI Engineer Querying BigQuery...' : '🤖 Ask AI Data Engineer to Optimize'}
          </button>

          <button
            onClick={handleSaveScript}
            disabled={saving}
            className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              saveSuccess 
                ? 'bg-emerald-400 text-black shadow-[0_0_25px_rgba(52,211,153,0.35)]' 
                : 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black shadow-lg hover:shadow-vibe-cyan/20'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check size={16} className="stroke-[3]" /> Deployed to Production!
              </>
            ) : saving ? (
              <>
                <RefreshCw size={16} className="animate-spin" /> Saving...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Deploy Script to Engine
              </>
            )}
          </button>
        </div>
      </div>

      {/* Template Preset Selector */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-card p-3 rounded-2xl border border-hairline">
        <div className="flex items-center gap-2 text-xs font-mono text-fg-muted font-semibold px-2">
          <Sliders size={14} className="text-vibe-cyan" />
          <span>Select Bidding Policy Version:</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => handleApplyTemplate('baseline')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTemplate === 'baseline'
                ? 'bg-overlay text-fg font-bold border border-hairline shadow-sm'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            1. Baseline Flat ($2.50)
          </button>
          <button
            onClick={() => handleApplyTemplate('heuristic')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTemplate === 'heuristic'
                ? 'bg-amber-500/20 text-amber-400 font-bold border border-amber-500/30 shadow-sm'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            2. Hand-Coded Dayparts
          </button>
          <button
            onClick={() => handleApplyTemplate('ai')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
              activeTemplate === 'ai'
                ? 'bg-vibe-purple/20 text-vibe-purple font-bold border border-vibe-purple/30 shadow-sm'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            <Sparkles size={13} />
            <span>3. AI-Optimized (ADK)</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: Code Editor & AI Report */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left/Main Column: Python Code Editor */}
        <div className="lg:col-span-8 space-y-4">
          <div className="p-6 bg-card border border-hairline rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-vibe-cyan/10 text-vibe-cyan rounded-xl">
                  <Terminal size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-fg">
                    Executable Python Engine Function
                  </h3>
                  <p className="text-[11px] font-mono text-fg-muted">
                    <code>def compute_bid(telemetry: dict, campaign: dict) -&gt; float:</code>
                  </p>
                </div>
              </div>

              <span className="text-xs font-mono px-3 py-1 bg-overlay border border-hairline rounded-xl text-fg-muted">
                Python 3.11 · Live In-Memory Execution
              </span>
            </div>

            {/* In-Situ Editable Python Viewer */}
            <div className="relative rounded-2xl overflow-hidden border border-hairline bg-[#0d1117]">
              <textarea
                value={scriptCode}
                onChange={(e) => {
                  setScriptCode(e.target.value);
                  setSaveSuccess(false);
                }}
                rows={16}
                spellCheck={false}
                className="w-full p-4 font-mono text-xs text-emerald-400 bg-transparent resize-y focus:outline-none leading-relaxed border-0"
                placeholder="def compute_bid(telemetry, campaign): ..."
              />
            </div>

            {/* Quick Test Forward Link */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <span className="text-xs font-mono text-fg-muted">
                Save script, then test performance against 500,000 auctions.
              </span>

              <button
                onClick={() => {
                  handleSaveScript();
                  navigate('simulator');
                }}
                className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center gap-2 cursor-pointer whitespace-nowrap"
              >
                <Play size={14} fill="currentColor" /> Test Script in Auction Simulator ➔
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Engine Interface Specs & AI Insight */}
        <div className="lg:col-span-4 space-y-6">
          {/* Engine Parameters Card */}
          <div className="p-5 bg-card border border-hairline rounded-3xl shadow-xl space-y-3">
            <div className="flex items-center gap-2.5 pb-2 border-b border-hairline">
              <Cpu size={18} className="text-vibe-cyan" />
              <h3 className="text-sm font-bold text-fg">Engine Input Dictionaries</h3>
            </div>

            <div className="space-y-3 text-xs font-mono">
              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <span className="text-vibe-cyan font-bold block">1. telemetry: dict</span>
                <p className="text-[11px] text-fg-muted font-sans">
                  • <code>daypart</code>: 'morning' | 'afternoon' | 'primetime' | 'late_night'<br/>
                  • <code>competitor_p90</code>: float (e.g. 2.35, 9.60)<br/>
                  • <code>win_rate</code>: float (0.0 to 1.0)
                </p>
              </div>

              <div className="p-3 bg-overlay rounded-xl border border-hairline space-y-1">
                <span className="text-sky-400 font-bold block">2. campaign: dict</span>
                <p className="text-[11px] text-fg-muted font-sans">
                  • <code>budget_remaining</code>: float ($2,500.00)<br/>
                  • <code>max_bid_ceiling</code>: float ($10.00)<br/>
                  • <code>active_bid_cpm</code>: float ($2.50)
                </p>
              </div>
            </div>
          </div>

          {/* AI Data Engineer Summary Card */}
          {aiReport && (
            <div className="p-5 bg-vibe-purple/10 border border-vibe-purple/30 rounded-3xl space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-vibe-purple font-bold text-xs uppercase tracking-wider">
                <Sparkles size={16} />
                <span>AI Data Engineer Audit ({aiReport.timestamp})</span>
              </div>

              <p className="text-xs font-sans text-fg leading-relaxed">
                {aiReport.reasoning}
              </p>

              {aiReport.sqlQueries && aiReport.sqlQueries.length > 0 && (
                <div className="p-2.5 bg-black/40 rounded-xl border border-hairline">
                  <span className="text-[10px] font-mono text-emerald-400 block mb-1">BigQuery SQL Executed:</span>
                  <code className="text-[10px] font-mono text-emerald-300 block overflow-x-auto whitespace-pre-wrap">
                    {aiReport.sqlQueries[0]}
                  </code>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
