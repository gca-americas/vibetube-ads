import { useState, useEffect } from 'react';
import { 
  ArrowLeft, CheckCircle2, 
  Code2, BarChart2, Play, Bot, BrainCircuit,
  Image as ImageIcon, Sliders, Check, 
  Sparkles
} from 'lucide-react';
import { generateAdImageFromPrompt } from '../lib/adCreativeGenerator';
import PythonCodeHighlight from './PythonCodeHighlight';

const RULE_BASED_CODE = `"""Vibetube Ads - Baseline Bidding Policy Script

This script is executed by the Vibetube Ad Serving Engine to compute active
CPM bids for incoming video ad auction requests.
"""

def compute_bid(telemetry: dict, campaign: dict) -> float:
    # Baseline Heuristic: Naive starting bid ($2.50 CPM)
    current_bid = campaign.get("active_bid_cpm", 2.50)
    ceiling = campaign.get("max_bid_ceiling", 10.00)
    
    return min(current_bid, ceiling)`;

const AGENT_CODE = `"""Vibetube Ads - AI-Optimized Bidding Policy Script
Authored by ADK AI Data Engineer Agent (Gemini 2.5 Flash) via BigQuery Telemetry.
"""

def compute_bid(telemetry: dict, campaign: dict) -> float:
    daypart = telemetry.get("daypart", "morning")
    p90 = telemetry.get("competitor_p90", 2.35)
    ceiling = campaign.get("max_bid_ceiling", 10.00)
    budget = campaign.get("budget_remaining", 2500.00)

    # Multi-Daypart Adaptive Clearance & Pacing Policy
    if daypart == "primetime":
        # Clear peak evening surge ($9.60 P90) with $0.05 safety buffer
        return min(p90 + 0.05, ceiling)
    elif daypart == "late_night":
        # Shade bids down to cooldown floor ($0.85 P90) to prevent 10x overpayment
        return min(0.90, ceiling)
    elif daypart == "afternoon":
        # Building afternoon traffic ($3.50 P90)
        return min(p90 + 0.05, ceiling)
    else: # morning
        # Baseline morning traffic ($2.35 P90)
        return min(2.40, ceiling)`;

const DEFAULT_CODES: Record<string, string> = {
  deterministic: RULE_BASED_CODE,
  reflective: AGENT_CODE,
};

export default function Campaigns({ 
  navigate, 
  setActiveLab: _setActiveLab,
}: { 
  navigate: (v: string) => void; 
  setActiveLab?: (v: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<'creative' | 'strategy'>('creative');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [generatingCreative, setGeneratingCreative] = useState(false);
  const [generationCount, setGenerationCount] = useState(0);

  // Editable Strategy Code State with Persistence across navigation & reloads
  const [strategyCodes, setStrategyCodes] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('vibetube_strategy_codes_v4');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === 'object') {
            // If reflective is old short string, upgrade it
            if (parsed.reflective && !parsed.reflective.startsWith('import os')) {
              parsed.reflective = AGENT_CODE;
            }
            return { ...DEFAULT_CODES, ...parsed };
          }
        }
      } catch (e) {
        console.warn('Failed to load strategy codes from localStorage:', e);
      }
    }
    return { ...DEFAULT_CODES };
  });

  // Single Campaign Configuration State
  const [formData, setFormData] = useState({
    id: 'camp-default',
    name: 'Neon Runner Launch',
    creativePrompt: 'Futuristic glowing neon sneakers for urban night runners',
    creativeTitle: 'Neon Runner Pro',
    creativeBanner: 'Responsive neon cushioning with kinetic energy return.',
    creativeUrl: '/images/creatives/sneaker.jpg',
    budget: 2500.0,
    bidCpm: 2.50,
    maxBidCeiling: 10.00,
    strategy: 'deterministic' as 'deterministic' | 'reflective',
  });

  // Fetch campaign config from server on mount
  useEffect(() => {
    fetchCampaignConfig();
  }, []);

  const fetchCampaignConfig = async () => {
    try {
      const res = await fetch('/campaign/config');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          setFormData(prev => ({
            ...prev,
            id: data.id || prev.id,
            name: data.name || prev.name,
            creativeTitle: data.creative_title || prev.creativeTitle,
            creativeBanner: data.creative_banner || prev.creativeBanner,
            creativeUrl: data.creative_url || prev.creativeUrl,
            budget: Number((data.total_budget ?? data.budget_remaining ?? prev.budget).toFixed(2)),
            bidCpm: Number((data.base_bid_cpm ?? 2.50).toFixed(2)),
            maxBidCeiling: Number((data.max_bid_ceiling ?? prev.maxBidCeiling).toFixed(2)),
            strategy: data.strategy || prev.strategy,
          }));

          if (data.strategy_codes && typeof data.strategy_codes === 'object') {
            setStrategyCodes(prev => {
              const serverCodes = { ...data.strategy_codes };
              if (serverCodes.reflective && !serverCodes.reflective.startsWith('import os')) {
                serverCodes.reflective = AGENT_CODE;
              }
              const merged = { ...prev, ...serverCodes };
              try {
                localStorage.setItem('vibetube_strategy_codes_v4', JSON.stringify(merged));
              } catch (e) {}
              return merged;
            });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load campaign config:', e);
    }
  };

  const updateForm = (patch: Partial<typeof formData>) => {
    setSaveSuccess(false);
    setFormData(prev => ({ ...prev, ...patch }));
  };

  const handleCodeChange = (newCode: string) => {
    setSaveSuccess(false);
    setStrategyCodes(prev => {
      const updated = {
        ...prev,
        [formData.strategy]: newCode,
      };
      try {
        localStorage.setItem('vibetube_strategy_codes', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const [testingAgent, setTestingAgent] = useState(false);
  const [agentTestResult, setAgentTestResult] = useState<any>(null);

  const handleTestAgentCycle = async () => {
    setTestingAgent(true);
    setAgentTestResult(null);
    try {
      const res = await fetch('/agent/run-cycle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setAgentTestResult(data);
        await fetchCampaignConfig();
      }
    } catch (e) {
      console.warn('Agent test failed:', e);
    } finally {
      setTestingAgent(false);
    }
  };

  const handleResetCode = () => {
    setSaveSuccess(false);
    setStrategyCodes(prev => {
      const updated = {
        ...prev,
        [formData.strategy]: DEFAULT_CODES[formData.strategy],
      };
      try {
        localStorage.setItem('vibetube_strategy_codes', JSON.stringify(updated));
      } catch (e) {}
      return updated;
    });
  };

  const handleGenerateCreative = async () => {
    if (!formData.creativePrompt.trim()) return;
    setGeneratingCreative(true);
    try {
      const res = await generateAdImageFromPrompt(formData.creativePrompt);
      const nextCount = generationCount + 1;
      setGenerationCount(nextCount);
      setFormData(prev => ({
        ...prev,
        creativeUrl: res.imageUrl,
        creativeTitle: res.title,
        creativeBanner: res.tagline,
      }));
    } catch (e) {
      console.error('Creative generation error:', e);
    } finally {
      setGeneratingCreative(false);
    }
  };

  const handleSaveCampaign = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const campId = formData.id || 'camp-default';
      
      const res = await fetch('/campaign/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: campId,
          name: formData.name,
          creative_url: formData.creativeUrl,
          creative_title: formData.creativeTitle,
          creative_banner: formData.creativeBanner,
          budget: formData.budget,
          bid_cpm: formData.bidCpm,
          max_bid_ceiling: formData.maxBidCeiling,
          strategy: formData.strategy,
          strategy_codes: strategyCodes,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
      }
    } catch (e) {
      console.error('Error saving campaign:', e);
      alert('Failed to save campaign. Please verify the ad server is running.');
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    {
      id: 'creative',
      title: '1. Creative & Flight',
      subtitle: 'Flight name & Gemini creative',
      icon: ImageIcon,
    },
    {
      id: 'strategy',
      title: '2. Bidding Strategy',
      subtitle: 'Rules vs Reasoning & Python Code',
      icon: Sliders,
    },
  ];

  return (
    <div className="animate-rise pb-24 space-y-8">
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
            onClick={() => navigate('simulator')}
            className="px-4 py-2 bg-overlay hover:bg-hairline text-fg rounded-xl text-xs font-medium border border-hairline transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Play size={14} /> Auction Simulator
          </button>
          <button 
            onClick={() => navigate('reporting')}
            className="px-4 py-2 bg-overlay hover:bg-hairline text-fg rounded-xl text-xs font-medium border border-hairline transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <BarChart2 size={14} /> Reporting
          </button>
        </div>
      </div>

      {/* Page Title & Save Action */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold mb-1">Campaign Studio</h1>
          <p className="text-fg-muted text-base">
            Configure campaign creatives, liquidity budget, and programmatic bidding intelligence.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveCampaign}
            disabled={saving}
            className={`px-6 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
              saveSuccess 
                ? 'bg-emerald-400 text-black shadow-[0_0_25px_rgba(52,211,153,0.35)]' 
                : 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black shadow-lg hover:shadow-vibe-cyan/20'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check size={15} className="stroke-[3]" /> Deployed to Ad Server!
              </>
            ) : saving ? (
              <>
                <Sparkles size={15} className="animate-spin" /> Deploying...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} /> Save & Deploy Campaign
              </>
            )}
          </button>
        </div>
      </div>

      {/* 2-Column Main Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Pane: 3 Navigation Tabs & Quick Status */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-card border border-hairline rounded-3xl p-3 shadow-xl space-y-2">
            <div className="px-3 pt-2 pb-1 text-[11px] font-bold uppercase tracking-wider text-fg-muted">
              Campaign Steps
            </div>

            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full p-4 rounded-2xl text-left transition-all cursor-pointer flex items-center gap-3.5 ${
                    isActive 
                      ? 'bg-vibe-cyan text-black font-bold shadow-[0_0_25px_rgba(45,212,191,0.25)]' 
                      : 'bg-overlay hover:bg-hairline text-fg border border-hairline'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl ${
                    isActive ? 'bg-black/10 text-black' : 'bg-black/40 text-vibe-cyan'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm leading-tight ${isActive ? 'font-bold text-black' : 'font-semibold text-fg'}`}>
                      {tab.title}
                    </div>
                    <div className={`text-xs truncate mt-0.5 ${isActive ? 'text-black/80 font-medium' : 'text-fg-muted'}`}>
                      {tab.subtitle}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Quick Campaign Summary Card */}
          <div className="p-5 bg-card border border-hairline rounded-3xl shadow-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-hairline pb-2.5">
              <span className="text-fg-muted uppercase tracking-wider text-[10px]">Flight Target:</span>
              <strong className="text-fg truncate max-w-[150px]">{formData.name}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-fg-muted">Budget:</span>
              <strong className="text-fg font-bold">${formData.budget.toFixed(2)}</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-fg-muted">Starting Bid:</span>
              <strong className="text-fg font-bold">${formData.bidCpm.toFixed(2)} CPM</strong>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-fg-muted">Max Bid Cap:</span>
              <strong className="text-vibe-cyan font-bold">${formData.maxBidCeiling.toFixed(2)} CPM</strong>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-fg-muted">Strategy:</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                formData.strategy === 'reflective' 
                  ? 'bg-vibe-cyan/10 text-vibe-cyan'
                  : 'bg-vibe-purple/10 text-vibe-purple'
              }`}>
                {formData.strategy === 'reflective' ? 'Reflective AI' : 'Deterministic'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Pane: Active Tab Workspace */}
        <div className="lg:col-span-8">
          <div className="bg-card border border-hairline rounded-3xl p-6 md:p-8 backdrop-blur-xl shadow-2xl space-y-6">
            {/* Tab 1: Creative & Metadata */}
            {activeTab === 'creative' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-display font-bold text-fg">1. Creative & Metadata</h2>
                  <p className="text-xs text-fg-muted mt-1">
                    Synthesize promotional copy and pre-roll graphic creatives using Gemini 2.5 Flash.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-fg-muted mb-1.5">
                      Campaign Flight Name
                    </label>
                    <input 
                      type="text" 
                      value={formData.name}
                      onChange={e => updateForm({ name: e.target.value })}
                      placeholder="e.g. Neon Runner Launch"
                      className="w-full bg-input border border-hairline rounded-xl px-4 py-3 text-fg focus:outline-none focus:border-vibe-cyan transition-colors text-sm"
                    />
                  </div>

                  <div className="p-6 bg-overlay border border-hairline rounded-2xl space-y-4">
                    <div>
                      <label className="text-sm font-bold text-fg flex items-center gap-2 mb-1">
                        <Sparkles size={16} className="text-vibe-purple" /> Gemini Creative Prompt
                      </label>
                      <p className="text-xs text-fg-muted">
                        Describe the product theme or target demographic. Gemini will generate the product headline, punchy tagline, and graphic ad.
                      </p>
                    </div>

                    <textarea 
                      rows={3}
                      value={formData.creativePrompt}
                      onChange={e => updateForm({ creativePrompt: e.target.value })}
                      placeholder="e.g. Futuristic glowing neon sneakers for urban night runners..."
                      className="w-full bg-input border border-hairline rounded-xl px-4 py-3 text-sm text-fg focus:outline-none focus:border-vibe-cyan transition-colors resize-none"
                    />

                    <button 
                      type="button"
                      onClick={handleGenerateCreative}
                      disabled={generatingCreative || !formData.creativePrompt.trim()}
                      className="w-full py-3 bg-vibe-purple hover:bg-vibe-purple/90 text-white rounded-xl font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-40 shadow-sm cursor-pointer text-sm"
                    >
                      <Sparkles size={16} />
                      {generatingCreative ? 'Generating Ad Creative with Gemini...' : 'Generate Creative with Gemini'}
                    </button>

                    {formData.creativeTitle && !generatingCreative && (
                      <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 size={14} /> Creative generated! Preview updated below.
                      </div>
                    )}
                  </div>

                  {/* Pre-Roll Video Ad Player Simulation Preview */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${formData.creativeUrl ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'}`} />
                        Pre-Roll Video Ad Preview
                      </span>
                      <span className="text-[11px] text-vibe-purple font-medium">Gemini 2.5 Flash</span>
                    </div>

                    <div className="bg-black border border-hairline rounded-2xl overflow-hidden shadow-2xl relative group min-h-[260px] flex flex-col justify-center">
                      {formData.creativeUrl ? (
                        <div className="relative aspect-video w-full bg-black overflow-hidden flex items-center justify-center">
                          <img 
                            key={`gen-${generationCount}`}
                            src={formData.creativeUrl} 
                            alt={formData.creativeTitle}
                            className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
                          />
                          <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md border border-white/15 px-2.5 py-1 rounded-md flex items-center gap-2 text-[10px] font-bold text-white tracking-wider uppercase">
                            <span className="bg-vibe-cyan text-black px-1.5 py-0.5 rounded text-[9px] font-black">AD</span>
                            <span>0:15</span>
                          </div>
                          <div className="absolute top-3 right-3 text-[10px] font-bold text-white/70 uppercase tracking-wider drop-shadow">
                            VIBETUBE AD NETWORK
                          </div>
                          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/95 via-black/75 to-transparent p-4 pt-8 flex items-end justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-[9px] font-bold uppercase tracking-widest text-vibe-cyan mb-0.5">Sponsored Spotlight</div>
                              <h4 className="text-white font-bold text-sm md:text-base truncate leading-tight drop-shadow">{formData.creativeTitle}</h4>
                              <p className="text-zinc-300 text-xs truncate mt-1 opacity-90 leading-tight drop-shadow">{formData.creativeBanner}</p>
                            </div>
                            <div className="shrink-0">
                              <span className="px-3 py-1.5 bg-vibe-cyan text-black font-bold text-xs rounded-xl shadow-[0_0_15px_rgba(45,212,191,0.4)] whitespace-nowrap">
                                Shop Now →
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="aspect-video w-full flex flex-col items-center justify-center text-center p-6 bg-zinc-950/80">
                          <div className="flex flex-col items-center justify-center text-center max-w-xs">
                            <div className="w-12 h-12 rounded-2xl bg-overlay border border-hairline flex items-center justify-center text-fg-muted mb-3">
                              <Bot size={20} className="text-vibe-purple" />
                            </div>
                            <h4 className="font-display font-bold text-sm text-fg">No Ad Creative Generated</h4>
                            <p className="text-xs text-fg-muted mt-1 leading-relaxed">
                              Enter a prompt above and click "Generate Creative with Gemini".
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div className="bg-zinc-950 px-4 py-2 border-t border-white/5 flex items-center justify-between text-[10px] text-fg-muted font-mono">
                        <span>Vibetube Video Player · Pre-Roll Break</span>
                        <span className="text-emerald-400">1080p 60fps</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-hairline">
                  <span className="text-xs text-fg-muted">Next: Select bidding strategy & inspect code</span>
                  <button 
                    onClick={() => setActiveTab('strategy')}
                    className="px-6 py-2.5 bg-vibe-blue hover:bg-vibe-blue/90 text-white rounded-xl font-medium transition-colors text-xs flex items-center gap-2 cursor-pointer"
                  >
                    Next: Strategy & Preview →
                  </button>
                </div>
              </div>
            )}

            {/* Tab 2: Bidding Strategy & Code Preview */}
            {activeTab === 'strategy' && (
              <div className="space-y-6 animate-fade-in">
                <div>
                  <h2 className="text-xl font-display font-bold text-fg">2. Bidding Strategy & Code Preview</h2>
                  <p className="text-xs text-fg-muted mt-1">
                    Choose the algorithm running your campaign flight and inspect its Python implementation.
                  </p>
                </div>

                {/* 2 Strategy Selector Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 1. Rule-Based Baseline */}
                  <button
                    type="button"
                    onClick={() => updateForm({ strategy: 'deterministic' })}
                    className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      formData.strategy === 'deterministic'
                        ? 'bg-vibe-purple/10 border-vibe-purple shadow-[0_0_20px_rgba(179,140,255,0.15)]'
                        : 'bg-overlay border-hairline hover:bg-hairline'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <Code2 size={16} className="text-vibe-purple" />
                        <span className="font-bold text-xs text-fg">Deterministic Rule</span>
                      </div>
                      <p className="text-xs text-fg-muted leading-relaxed">
                        Static if/else heuristic adjusting bids based on win rate thresholds.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-vibe-purple mt-3 font-semibold">
                      rule_based_optimizer.py
                    </span>
                  </button>

                  {/* 2. Autonomous Reasoning Agent */}
                  <button
                    type="button"
                    onClick={() => updateForm({ strategy: 'reflective' })}
                    className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      formData.strategy === 'reflective'
                        ? 'bg-vibe-cyan/10 border-vibe-cyan shadow-[0_0_20px_rgba(45,212,191,0.2)]'
                        : 'bg-overlay border-hairline hover:bg-hairline'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <BrainCircuit size={16} className="text-vibe-cyan" />
                        <span className="font-bold text-xs text-fg">Autonomous Reasoning Agent</span>
                      </div>
                      <p className="text-xs text-fg-muted leading-relaxed">
                        ADK 2.0 Gemini agent with live telemetry reasoning, rolling history audits, and bid shading.
                      </p>
                    </div>
                    <span className="text-[10px] font-mono text-vibe-cyan mt-3 font-semibold">
                      yield_agent.py
                    </span>
                  </button>
                </div>

                {/* Strategy Details Banner */}
                <div className="p-4 bg-overlay border border-hairline rounded-2xl text-xs space-y-1">
                  <div className="font-bold text-fg flex items-center gap-2">
                    <span>Strategy Mechanics:</span>
                    <span className="font-mono text-fg-muted">
                      {formData.strategy === 'deterministic' 
                        ? 'Deterministic Heuristic' 
                        : 'ADK 2.0 Autonomous Reflection'}
                    </span>
                  </div>
                  <p className="text-fg-muted leading-relaxed">
                    {formData.strategy === 'deterministic' ? (
                      <>
                        Adjusts active bid CPM based strictly on win rate thresholds. In volatile markets, it slowly crawls up in fixed steps without real-time clearing intelligence.
                      </>
                    ) : (
                      <>
                        Equipped with <code className="text-vibe-cyan">get_bidding_history</code>, this agent audits historical rolling windows to detect market surges instantly and shade bids down during competitor pullbacks.
                      </>
                    )}
                  </p>
                </div>

                {/* Code Preview Box with Syntax Highlighting & Interactive Editing */}
                <PythonCodeHighlight 
                  code={strategyCodes[formData.strategy] || DEFAULT_CODES[formData.strategy]}
                  filename={formData.strategy === 'deterministic' ? 'rule_based_optimizer.py' : 'yield_agent.py'}
                  editable={true}
                  onChange={handleCodeChange}
                  onReset={handleResetCode}
                  isModified={strategyCodes[formData.strategy] !== DEFAULT_CODES[formData.strategy]}
                />

                {/* Live Gemini 2.5 Flash Agent Tester */}
                {formData.strategy === 'reflective' && (
                  <div className="p-6 bg-card border-2 border-vibe-cyan/30 rounded-3xl shadow-xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-vibe-cyan/15 text-vibe-cyan rounded-xl">
                          <Bot size={20} />
                        </div>
                        <div>
                          <h4 className="text-xs font-display font-bold text-fg">
                            Live Agent Execution Engine (Gemini 2.5 Flash + BigQuery)
                          </h4>
                          <p className="text-[11px] text-fg-muted">
                            Execute a live reasoning cycle on Google Cloud Vertex AI against real telemetry.
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handleTestAgentCycle}
                        disabled={testingAgent}
                        className="px-5 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold rounded-xl text-xs transition-all shadow-[0_0_20px_rgba(45,212,191,0.25)] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 whitespace-nowrap"
                      >
                        <Sparkles size={14} className={testingAgent ? 'animate-spin' : ''} />
                        {testingAgent ? 'Executing on Vertex AI...' : '⚡ Run Live Agent Cycle'}
                      </button>
                    </div>

                    {agentTestResult && (
                      <div className="p-4 bg-overlay border border-hairline rounded-2xl space-y-3 animate-fade-in text-xs">
                        <div className="flex items-center justify-between border-b border-hairline pb-2">
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1.5">
                            <CheckCircle2 size={13} /> Live Cycle Executed Successfully
                          </span>
                          <span className="font-mono text-vibe-cyan font-bold">
                            Active Bid: ${agentTestResult.active_bid_cpm?.toFixed(2)} CPM
                          </span>
                        </div>

                        <div>
                          <span className="text-[10px] font-mono text-fg-muted uppercase tracking-wider block mb-1">
                            Gemini 2.5 Flash Rationale:
                          </span>
                          <p className="text-xs text-fg leading-relaxed bg-card p-3 rounded-xl border border-hairline">
                            {agentTestResult.reasoning}
                          </p>
                        </div>

                        {agentTestResult.sql_queries && agentTestResult.sql_queries.length > 0 && (
                          <div>
                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block mb-1">
                              Google Cloud BigQuery SQL Executed:
                            </span>
                            <pre className="text-xs font-mono text-emerald-700 dark:text-emerald-300 bg-card p-3 rounded-xl border border-hairline overflow-x-auto whitespace-pre-wrap">
                              {agentTestResult.sql_queries[0]}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Inline Success & Next Steps Banner */}
                {saveSuccess && (
                  <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-in shadow-lg">
                    <div className="flex items-center gap-3 text-emerald-400">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0">
                        <CheckCircle2 size={18} className="text-emerald-400" />
                      </div>
                      <div>
                        <div className="font-bold text-xs">Campaign Successfully Deployed!</div>
                        <div className="text-[11px] text-emerald-400/80 mt-0.5">
                          Strategy: <strong className="capitalize">{formData.strategy}</strong> · Max Bid Ceiling: <strong>${formData.maxBidCeiling.toFixed(2)} CPM</strong>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate('simulator')}
                      className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-black font-bold rounded-xl text-xs transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
                    >
                      <Play size={13} fill="currentColor" /> Run in Auction Simulator →
                    </button>
                  </div>
                )}

                <div className="flex justify-between items-center pt-4 border-t border-hairline">
                  <button 
                    onClick={() => setActiveTab('creative')}
                    className="px-5 py-2.5 rounded-xl text-fg-muted hover:text-fg hover:bg-overlay font-medium transition-colors text-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    ← Back to Creative
                  </button>
                  <button 
                    onClick={handleSaveCampaign}
                    disabled={saving}
                    className={`px-8 py-3 rounded-xl font-bold transition-all text-xs flex items-center gap-2 cursor-pointer disabled:opacity-50 ${
                      saveSuccess 
                        ? 'bg-emerald-400 text-black shadow-[0_0_25px_rgba(52,211,153,0.35)]' 
                        : 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black shadow-[0_0_25px_rgba(45,212,191,0.3)]'
                    }`}
                  >
                    {saveSuccess ? (
                      <>
                        <Check size={16} className="stroke-[3]" /> Deployed to Ad Server!
                      </>
                    ) : saving ? (
                      <>
                        <Sparkles size={16} className="animate-spin" /> Deploying...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Save & Deploy Campaign
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
