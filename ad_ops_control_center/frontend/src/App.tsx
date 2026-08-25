import { useState } from 'react';
import { Ambience } from './components/Ambience';
import Lab1DynamicBidding from './components/Lab1DynamicBidding';
import TopNav from './components/TopNav';

import Console from './components/Console';
import Campaigns from './components/Campaigns';
import Simulator from './components/Simulator';
import BiddingPolicy from './components/BiddingPolicy';

function App() {
  // Navigation states: 'console', 'campaigns', 'simulator', 'policy', 'lab1', 'lab2'
  const [activeLab, setActiveLab] = useState('console');

  return (
    <div className="min-h-screen bg-stage text-fg font-sans relative overflow-hidden flex flex-col">
      <Ambience />
      
      <div className="relative z-10 flex flex-col h-screen">
        <TopNav activeLab={activeLab} setActiveLab={setActiveLab} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 flex justify-center">
          <div className="w-full max-w-6xl">
            {activeLab === 'console' && <Console navigate={setActiveLab} />}
            
            <div className={activeLab === 'campaigns' ? 'block' : 'hidden'}>
              <Campaigns navigate={setActiveLab} setActiveLab={setActiveLab} />
            </div>
            
            <div className={activeLab === 'simulator' ? 'block' : 'hidden'}>
              <Simulator navigate={setActiveLab} activeLab={activeLab} />
            </div>

            <div className={activeLab === 'policy' ? 'block' : 'hidden'}>
              <BiddingPolicy navigate={setActiveLab} />
            </div>
            
            {activeLab === 'lab1' && <Lab1DynamicBidding setActiveLab={setActiveLab} />}
            {activeLab === 'lab2' && (
              <div className="p-12 text-center bg-card rounded-3xl border border-hairline backdrop-blur-xl max-w-2xl mx-auto mt-20 shadow-2xl">
                <div className="text-4xl mb-4">🚧</div>
                <h2 className="text-3xl font-display font-bold tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-fg to-fg/50">Lab 02: Yield Optimization</h2>
                <p className="text-fg-muted text-lg">This module is currently in development.</p>
                <button onClick={() => setActiveLab('campaigns')} className="mt-8 px-6 py-3 bg-overlay hover:bg-hairline rounded-xl font-medium transition-colors">
                  Return to Campaigns
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
