export default function Home({ setActiveLab }: { setActiveLab: (id: string) => void }) {
  return (
    <div className="space-y-8 animate-fade-in py-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* Lab 1 */}
        <div 
          onClick={() => setActiveLab('lab1')}
          className="bg-card hover:bg-card-hover border border-hairline p-6 rounded-3xl transition-all cursor-pointer group shadow-2xl hover:shadow-vibe-cyan/20 hover:-translate-y-2 duration-500 flex flex-col justify-between"
        >
          <div>
            <div className="flex items-center space-x-3 mb-3">
              <span className="w-8 h-8 rounded-full bg-vibe-cyan/10 flex items-center justify-center text-vibe-cyan font-bold font-mono text-xs">01</span>
              <h2 className="text-2xl font-display group-hover:text-vibe-cyan transition-colors">Autonomous Yield Optimization</h2>
            </div>
            <p className="text-fg-muted text-sm leading-relaxed mb-5">
              Build an autonomous ADK Yield Agent with Gemini and BigQuery to dynamically optimize bids with closed-loop reflection.
            </p>
          </div>
          <div className="flex items-center text-vibe-cyan font-bold text-xs tracking-widest uppercase">
            Launch Control Console <span className="ml-2 group-hover:translate-x-2 transition-transform">→</span>
          </div>
        </div>
        
        {/* Lab 2 */}
        <div className="bg-card border border-hairline p-6 rounded-3xl opacity-60 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-3">
                <span className="w-8 h-8 rounded-full bg-overlay flex items-center justify-center text-fg-muted font-bold font-mono text-xs">02</span>
                <h2 className="text-2xl font-display">Ad Fraud Patrol & Anomaly Defense</h2>
              </div>
              <span className="px-3 py-1 bg-overlay rounded-full text-[10px] font-bold tracking-widest uppercase text-fg-muted">Coming Soon</span>
            </div>
            <p className="text-fg-muted text-sm leading-relaxed">
              Detect anomalous clickstream surges, identify bot patterns, and equip autonomous quarantine tools to protect ad spend.
            </p>
          </div>
        </div>

        {/* Lab 3 */}
        <div className="bg-card border border-hairline p-6 rounded-3xl opacity-60 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-3">
                <span className="w-8 h-8 rounded-full bg-overlay flex items-center justify-center text-fg-muted font-bold font-mono text-xs">03</span>
                <h2 className="text-2xl font-display">Agent-Guarded Privacy Clean Rooms</h2>
              </div>
              <span className="px-3 py-1 bg-overlay rounded-full text-[10px] font-bold tracking-widest uppercase text-fg-muted">Coming Soon</span>
            </div>
            <p className="text-fg-muted text-sm leading-relaxed">
              Implement differential privacy and gatekeeper reasoning agents to govern advertiser audience queries.
            </p>
          </div>
        </div>

        {/* Lab 4 */}
        <div className="bg-card border border-hairline p-6 rounded-3xl opacity-60 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-3">
              <div className="flex items-center space-x-3">
                <span className="w-8 h-8 rounded-full bg-overlay flex items-center justify-center text-fg-muted font-bold font-mono text-xs">04</span>
                <h2 className="text-2xl font-display">Autonomous Ad Ops Control Room</h2>
              </div>
              <span className="px-3 py-1 bg-overlay rounded-full text-[10px] font-bold tracking-widest uppercase text-fg-muted">Coming Soon</span>
            </div>
            <p className="text-fg-muted text-sm leading-relaxed">
              Capstone: Multi-agent orchestration combining yield optimization, fraud patrol, and privacy governance.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
