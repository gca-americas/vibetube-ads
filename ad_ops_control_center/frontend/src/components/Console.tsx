import { ArrowRight } from 'lucide-react';

export default function Console({ navigate }: { navigate: (view: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] max-w-4xl mx-auto animate-rise space-y-10 py-12">
      {/* Hero Narrative Section */}
      <div className="text-center space-y-5 max-w-3xl">
        <h1 className="text-5xl font-display font-bold tracking-tight text-fg leading-tight">
          Vibetube Ad Ops Control Center
        </h1>
        
        <p className="text-fg-muted text-lg leading-relaxed">
          You're the Lead Ad Ops Data Engineer at Vibetube. Video streaming ad revenue has flatlined, 
          fixed-bid campaigns are losing high-value primetime viewers, and cash is burning during late-night dropouts. 
          Step onto the auction exchange, audit BigQuery telemetry, and build an autonomous AI agent to turn ad yield around.
        </p>
      </div>

      {/* Single Primary Action Button */}
      <div className="flex flex-col items-center gap-3 pt-2">
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
    </div>
  );
}
