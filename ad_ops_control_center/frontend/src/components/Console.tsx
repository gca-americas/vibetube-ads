export default function Console({ navigate }: { navigate: (view: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-6xl mx-auto animate-rise">
      <h1 className="text-4xl font-display font-bold tracking-tight mb-12 text-fg">
        Control Console
      </h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        <button 
          onClick={() => navigate('campaigns')}
          className="flex flex-col items-center justify-center p-12 bg-card hover:bg-card-hover border border-hairline rounded-3xl transition-all hover:-translate-y-2 hover:shadow-[0_0_40px_rgba(59,130,246,0.15)] group"
        >
          <h2 className="text-2xl font-display font-bold mb-2">Campaign Studio</h2>
          <p className="text-fg-muted text-center">Configure flight parameters, generate creatives, and deploy bidding strategies.</p>
        </button>
        
        <button 
          onClick={() => navigate('simulator')}
          className="flex flex-col items-center justify-center p-12 bg-card hover:bg-card-hover border border-hairline rounded-3xl transition-all hover:-translate-y-2 hover:shadow-[0_0_40px_rgba(236,72,153,0.15)] group"
        >
          <h2 className="text-2xl font-display font-bold mb-2">Auction Simulator</h2>
          <p className="text-fg-muted text-center">Simulate live ad auctions to generate telemetry.</p>
        </button>

        <button 
          onClick={() => navigate('reporting')}
          className="flex flex-col items-center justify-center p-12 bg-card hover:bg-card-hover border border-hairline rounded-3xl transition-all hover:-translate-y-2 hover:shadow-[0_0_40px_rgba(139,92,246,0.15)] group"
        >
          <h2 className="text-2xl font-display font-bold mb-2">Reporting</h2>
          <p className="text-fg-muted text-center">Analyze telemetry, win rates, and ROAS.</p>
        </button>
      </div>
    </div>
  );
}
