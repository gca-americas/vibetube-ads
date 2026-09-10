import { ArrowRight, Sparkles } from 'lucide-react';

export default function Console({ navigate }: { navigate: (view: string) => void }) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-5xl mx-auto animate-rise space-y-10 py-8 px-4">
            {/* Hero Narrative Section */}
            <div className="text-center space-y-5 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-vibe-cyan/10 border border-vibe-cyan/25 text-vibe-cyan text-xs font-mono font-bold tracking-wide">
                    <Sparkles size={14} />
                    <span>ADK 2.0 · Gemini · BigQuery</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight text-fg leading-tight">
                    Vibetube Ad Ops Workbench
                </h1>

                <p className="text-fg-muted text-base md:text-lg leading-relaxed">
                    Your mission: build an autonomous{' '}
                    <strong className="text-fg font-semibold">Agentic Data Engineer</strong> powered by{' '}
                    <strong className="text-vibe-cyan font-semibold">ADK 2.0</strong> and{' '}
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
                    10 Interactive Steps · ~75–85 mins · Evaluated Live in BigQuery & ADK
                </span>
            </div>
        </div>
    );
}
