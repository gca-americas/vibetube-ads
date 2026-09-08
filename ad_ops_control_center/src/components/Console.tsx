import { ArrowRight, Sparkles, Layers, Bot, Workflow } from 'lucide-react';

export default function Console({ navigate }: { navigate: (view: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-5xl mx-auto animate-rise space-y-10 py-8 px-4">
      {/* Hero Narrative Section */}
      <div className="text-center space-y-5 max-w-3xl">
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-vibe-cyan/10 border border-vibe-cyan/25 text-vibe-cyan text-xs font-mono font-bold tracking-wide">
          <Sparkles size={14} />
          <span>Google Cloud ADK 2.0 · Gemini · BigQuery Telemetry</span>
        </div>

        <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-fg leading-tight">
          Vibetube Ad Ops Control Center
        </h1>

        <p className="text-fg-muted text-base md:text-lg leading-relaxed">
          Your company has an incredible product, but customer reach is stalling. To scale acquisition, 
          you're launching a video ad campaign on Vibetube's first-price real-time auction exchange. 
          Fixed bids burn cash during off-peak hours and lose high-value primetime slots, while hand-coded 
          heuristics quickly hit a complexity wall. Your mission: build an autonomous{' '}
          <strong className="text-fg font-semibold">Agentic Data Engineer</strong> powered by{' '}
          <strong className="text-vibe-cyan font-semibold">Google Cloud ADK 2.0</strong> and{' '}
          <strong className="text-vibe-purple font-semibold">Gemini</strong> to analyze BigQuery telemetry, 
          evaluate policies with semantic judges, and orchestrate an Actor-Critic flywheel to crown a champion bidding policy.
        </p>
      </div>

      {/* Single Primary Action Button */}
      <div className="flex flex-col items-center gap-3 pt-1">
        <button
          onClick={() => navigate('campaigns')}
          className="px-10 py-4 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-base rounded-2xl transition-all shadow-[0_0_35px_rgba(45,212,191,0.35)] hover:shadow-[0_0_50px_rgba(45,212,191,0.5)] hover:scale-105 flex items-center gap-3 cursor-pointer group"
        >
          <span>🚀 Start Lab · Campaign Studio</span>
          <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
        </button>
        <span className="text-xs font-mono text-fg-muted">
          12 Interactive Steps · ~75–85 mins · Evaluated Live in BigQuery & ADK
        </span>
      </div>

      {/* Narrative Milestone Roadmap */}
      <div className="w-full grid grid-cols-1 md:grid-cols-3 gap-5 pt-4 text-left">
        {/* Act 1 */}
        <button
          onClick={() => navigate('campaigns')}
          className="p-6 bg-card/60 hover:bg-card border border-hairline hover:border-vibe-cyan/40 rounded-3xl space-y-3 transition-all text-left group cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-vibe-cyan">
              <Layers size={18} />
              <span className="text-xs font-mono font-bold uppercase tracking-wider">Act I · Steps 1–4</span>
            </div>
            <ArrowRight size={15} className="text-fg-muted group-hover:text-vibe-cyan group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-bold text-fg group-hover:text-vibe-cyan transition-colors">
            Campaign & Complexity Wall
          </h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            Generate creative with Gemini & Imagen 3, benchmark 500k auctions with a $2.50 fixed bid, and experience the limits of manual heuristics.
          </p>
        </button>

        {/* Act 2 */}
        <button
          onClick={() => navigate('ai_engineer')}
          className="p-6 bg-card/60 hover:bg-card border border-hairline hover:border-vibe-purple/40 rounded-3xl space-y-3 transition-all text-left group cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-vibe-purple">
              <Bot size={18} />
              <span className="text-xs font-mono font-bold uppercase tracking-wider">Act II · Steps 5–8</span>
            </div>
            <ArrowRight size={15} className="text-fg-muted group-hover:text-vibe-purple group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-bold text-fg group-hover:text-vibe-purple transition-colors">
            ADK 2.0 Agent & Eval
          </h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            Equip Gemini with BigQuery telemetry tools, synthesize dynamic bidding policies, and implement LLM-as-a-Judge evaluations with <code className="text-vibe-purple font-mono">adk eval</code>.
          </p>
        </button>

        {/* Act 3 */}
        <button
          onClick={() => navigate('wire_loop')}
          className="p-6 bg-card/60 hover:bg-card border border-hairline hover:border-pink-500/40 rounded-3xl space-y-3 transition-all text-left group cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-pink-400">
              <Workflow size={18} />
              <span className="text-xs font-mono font-bold uppercase tracking-wider">Act III · Steps 9–12</span>
            </div>
            <ArrowRight size={15} className="text-fg-muted group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
          </div>
          <h3 className="text-base font-bold text-fg group-hover:text-pink-400 transition-colors">
            Flywheel & Scorecard
          </h3>
          <p className="text-xs text-fg-muted leading-relaxed">
            Wire an autonomous Actor-Critic loop across multi-round candidate iterations, and benchmark champion yield against baseline metrics.
          </p>
        </button>
      </div>
    </div>
  );
}
