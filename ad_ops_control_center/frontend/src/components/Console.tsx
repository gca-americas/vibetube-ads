import { Layers, Sparkles, ArrowRight, Activity, Database } from 'lucide-react';

export default function Console({ navigate }: { navigate: (view: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[72vh] max-w-5xl mx-auto animate-rise space-y-10 py-6">
      {/* Hero Narrative Section */}
      <div className="text-center space-y-4 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-vibe-cyan/10 border border-vibe-cyan/30 text-vibe-cyan text-xs font-mono font-bold uppercase tracking-wider">
          <Activity size={14} className="animate-pulse" /> Mission Briefing · Ad Yield Crisis
        </div>
        
        <h1 className="text-5xl font-display font-bold tracking-tight text-fg leading-tight">
          Vibetube Ad Ops Control Center
        </h1>
        
        <p className="text-fg-muted text-base leading-relaxed">
          You're the Lead Ad Ops Data Engineer at Vibetube. Video streaming ad revenue has flatlined, 
          fixed-bid campaigns are losing high-value primetime viewers, and cash is burning during late-night dropouts. 
          Step onto the auction exchange, audit BigQuery telemetry, and build an autonomous AI agent to turn ad yield around.
        </p>
      </div>

      {/* Single Primary Action Button */}
      <div className="flex flex-col items-center gap-3">
        <button
          onClick={() => navigate('campaigns')}
          className="px-10 py-4 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-base rounded-2xl transition-all shadow-[0_0_35px_rgba(45,212,191,0.35)] hover:shadow-[0_0_50px_rgba(45,212,191,0.5)] hover:scale-105 flex items-center gap-3 cursor-pointer group"
        >
          <span>🚀 Launch Lab: Step 1 · Campaign Studio</span>
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
        <span className="text-xs font-mono text-fg-muted">
          Estimated completion time: ~60-75 mins · All code evaluated live
        </span>
      </div>

      {/* Narrative Milestone Roadmap */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
        <div className="p-6 bg-card/60 border border-hairline rounded-3xl space-y-3">
          <div className="flex items-center gap-2 text-vibe-cyan">
            <Layers size={18} />
            <span className="text-xs font-mono font-bold uppercase tracking-wider">Phase 1</span>
          </div>
          <h3 className="text-base font-bold text-fg">Define & Simulate</h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            Generate video ad creatives with Gemini & Imagen 3, then run the baseline $2.50 flight across 500,000 auctions.
          </p>
        </div>

        <div className="p-6 bg-card/60 border border-hairline rounded-3xl space-y-3">
          <div className="flex items-center gap-2 text-pink-400">
            <Database size={18} />
            <span className="text-xs font-mono font-bold uppercase tracking-wider">Phase 2</span>
          </div>
          <h3 className="text-base font-bold text-fg">BigQuery Investigation</h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            Execute standard SQL queries to uncover the $9.60 primetime surge vs $0.85 late-night clearance floors.
          </p>
        </div>

        <div className="p-6 bg-card/60 border border-hairline rounded-3xl space-y-3">
          <div className="flex items-center gap-2 text-vibe-purple">
            <Sparkles size={18} />
            <span className="text-xs font-mono font-bold uppercase tracking-wider">Phase 3</span>
          </div>
          <h3 className="text-base font-bold text-fg">ADK 2.0 AI Agent</h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            Equip Gemini 2.5 Flash with BigQuery tools to synthesize an adaptive policy with dynamic bid shading.
          </p>
        </div>
      </div>
    </div>
  );
}
