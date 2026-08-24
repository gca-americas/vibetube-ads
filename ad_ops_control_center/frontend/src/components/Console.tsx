import { Layers, Play, BarChart2, Code2 } from 'lucide-react';

export default function Console({ navigate }: { navigate: (view: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-6xl mx-auto animate-rise space-y-10">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-display font-bold tracking-tight text-fg">
          Vibetube Ad Ops Control Center
        </h1>
        <p className="text-fg-muted text-base max-w-xl mx-auto">
          Follow the 4-step workflow: Define your campaign, simulate auctions, analyze telemetry in BigQuery, and author optimal bidding policies.
        </p>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        {/* Step 1: Campaigns */}
        <button 
          onClick={() => navigate('campaigns')}
          className="flex flex-col items-start p-8 bg-card hover:bg-card-hover border border-hairline rounded-3xl transition-all hover:-translate-y-1.5 hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] group text-left cursor-pointer space-y-4"
        >
          <div className="p-3 bg-vibe-cyan/10 text-vibe-cyan rounded-2xl group-hover:scale-110 transition-transform">
            <Layers size={24} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-vibe-cyan block mb-1">
              Step 1
            </span>
            <h2 className="text-xl font-display font-bold text-fg mb-1">Campaign Studio</h2>
            <p className="text-xs text-fg-muted leading-relaxed">
              Configure flight parameters, creative assets, and authorized spending ceilings.
            </p>
          </div>
        </button>
        
        {/* Step 2: Simulator */}
        <button 
          onClick={() => navigate('simulator')}
          className="flex flex-col items-start p-8 bg-card hover:bg-card-hover border border-hairline rounded-3xl transition-all hover:-translate-y-1.5 hover:shadow-[0_0_40px_rgba(236,72,153,0.15)] group text-left cursor-pointer space-y-4"
        >
          <div className="p-3 bg-pink-500/10 text-pink-400 rounded-2xl group-hover:scale-110 transition-transform">
            <Play size={24} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-pink-400 block mb-1">
              Step 2, 5, 8
            </span>
            <h2 className="text-xl font-display font-bold text-fg mb-1">Auction Simulator</h2>
            <p className="text-xs text-fg-muted leading-relaxed">
              Simulate 500,000 live ad auctions across market volatility cycles and benchmark yield.
            </p>
          </div>
        </button>

        {/* Step 3: Reporting */}
        <button 
          onClick={() => navigate('reporting')}
          className="flex flex-col items-start p-8 bg-card hover:bg-card-hover border border-hairline rounded-3xl transition-all hover:-translate-y-1.5 hover:shadow-[0_0_40px_rgba(139,92,246,0.15)] group text-left cursor-pointer space-y-4"
        >
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-2xl group-hover:scale-110 transition-transform">
            <BarChart2 size={24} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 block mb-1">
              Step 3, 6, 9
            </span>
            <h2 className="text-xl font-display font-bold text-fg mb-1">BigQuery Reporting</h2>
            <p className="text-xs text-fg-muted leading-relaxed">
              Execute live SQL queries to audit market clearing floors, dayparting, and trend history.
            </p>
          </div>
        </button>

        {/* Step 4: Bidding Policy */}
        <button 
          onClick={() => navigate('policy')}
          className="flex flex-col items-start p-8 bg-card hover:bg-card-hover border border-hairline rounded-3xl transition-all hover:-translate-y-1.5 hover:shadow-[0_0_40px_rgba(168,85,247,0.15)] group text-left cursor-pointer space-y-4"
        >
          <div className="p-3 bg-vibe-purple/10 text-vibe-purple rounded-2xl group-hover:scale-110 transition-transform">
            <Code2 size={24} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-vibe-purple block mb-1">
              Step 4 & 8
            </span>
            <h2 className="text-xl font-display font-bold text-fg mb-1">Bidding Policy & AI</h2>
            <p className="text-xs text-fg-muted leading-relaxed">
              Author custom Python algorithms or invoke the AI Data Engineer to optimize yield.
            </p>
          </div>
        </button>
      </div>
    </div>
  );
}
