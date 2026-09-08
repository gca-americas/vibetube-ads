import { useState } from 'react';

export default function Sidebar({ activeLab, setActiveLab }: { activeLab: string, setActiveLab: (id: string) => void }) {
  const [loading, setLoading] = useState<string | null>(null);

  const simulate = async (endpoint: string, payload?: any) => {
    setLoading(endpoint);
    try {
      const res = await fetch(`/simulation/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload ? JSON.stringify(payload) : undefined
      });
      if (!res.ok) throw new Error('Request failed');
    } catch (e) {
      console.error(e);
    }
    setLoading(null);
  };

  const navItems = [
    { id: 'home', label: 'Home' },
    { id: 'lab1', label: 'Lab 01: Dynamic Bidding' },
    { id: 'lab2', label: 'Lab 02: Yield Optimization' },
    { id: 'lab3', label: 'Lab 03: Privacy Clean Rooms' },
    { id: 'lab4', label: 'Lab 04: Capstone Control Room' }
  ];

  return (
    <div className="w-80 border-r border-hairline bg-card/40 backdrop-blur-xl h-full flex flex-col">
      <div className="p-6">
        <img src="/vibetube_ads_logo_dark.png" alt="Vibetube Ads" className="w-full mb-6" />
        <h1 className="font-display text-xl font-bold tracking-tight mb-8 text-transparent bg-clip-text bg-gradient-to-br from-fg to-fg/60">
          Ad Ops Control Center
        </h1>
        
        <h2 className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-4">Simulate Ad Auctions</h2>
        <div className="space-y-3 mb-8">
          <button 
            onClick={() => simulate('run', { userId: 'student-1', numAuctions: 20 })}
            className="w-full text-left px-4 py-3 bg-card hover:bg-card-hover border border-hairline rounded-xl transition-all flex items-center text-sm font-medium"
          >
            <span className="mr-3 text-vibe-purple">⚡</span> 
            {loading === 'run' ? 'Simulating...' : 'Simulate 20 Auctions'}
          </button>
          
          <button 
            onClick={() => simulate('run', { userId: 'student-1', numAuctions: 100 })}
            className="w-full text-left px-4 py-3 bg-card hover:bg-card-hover border border-hairline rounded-xl transition-all flex items-center text-sm font-medium"
          >
            <span className="mr-3 text-vibe-purple">⚡</span> 
            Simulate 100 Auctions
          </button>
          
          <button 
            onClick={() => simulate('spike')}
            className="w-full text-left px-4 py-3 bg-card hover:bg-card-hover border border-hairline rounded-xl transition-all flex items-center text-sm font-medium group"
          >
            <span className="mr-3 text-vibe-red group-hover:animate-pulse">📈</span> 
            Trigger Market Spike
          </button>
          
          <button 
            onClick={() => simulate('reset')}
            className="w-full text-left px-4 py-3 bg-card hover:bg-card-hover border border-hairline rounded-xl transition-all flex items-center text-sm font-medium"
          >
            <span className="mr-3 text-vibe-cyan">🔄</span> 
            Reset Campaign
          </button>
        </div>

        <h2 className="text-xs font-bold uppercase tracking-wider text-fg-muted mb-4">Lab Selection</h2>
        <div className="space-y-1">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveLab(item.id)}
              className={`w-full text-left px-4 py-2.5 rounded-lg text-sm transition-all ${
                activeLab === item.id 
                  ? 'bg-vibe-red/10 text-vibe-red font-medium' 
                  : 'text-fg-muted hover:text-fg hover:bg-overlay'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
