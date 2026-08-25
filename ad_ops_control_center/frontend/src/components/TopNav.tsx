import { useState, useEffect } from 'react';
import { Moon, Sun, Home } from 'lucide-react';
import { Logo } from './Logo';

export default function TopNav({ activeLab, setActiveLab }: { activeLab?: string, setActiveLab: (id: string) => void }) {
  const [isDark, setIsDark] = useState(() => {
    // Check if the user has manually set a preference, otherwise use OS preference
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  return (
    <nav className="border-b border-hairline bg-card/40 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
        <div 
          className="flex items-center cursor-pointer group"
          onClick={() => setActiveLab('console')}
        >
          <Logo theme={isDark ? 'dark' : 'light'} shine={false} className="w-[96px] drop-shadow-md transition-transform group-hover:scale-105" />
        </div>

        <div className="flex items-center space-x-3">
          <div className="hidden sm:flex items-center space-x-2 mr-2 bg-overlay px-3.5 py-1.5 rounded-full border border-hairline">
             <span className="w-2 h-2 rounded-full bg-vibe-cyan animate-pulse" />
             <span className="text-[11px] font-bold tracking-wider uppercase text-fg-muted">Engine Online</span>
          </div>
          
          <button 
            onClick={() => setIsDark(!isDark)}
            className="p-2 hover:opacity-80 transition-all flex items-center justify-center cursor-pointer rounded-lg"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-5 h-5 text-[#fdba12]" />
            ) : (
              <Moon className="w-5 h-5 text-[#6362f9]" />
            )}
          </button>
        </div>
      </div>

      {/* Dedicated Second Header for Lab Flow & Step Navigation */}
      <div className="border-t border-hairline bg-card/25 backdrop-blur-md px-4 md:px-8 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between overflow-x-auto gap-3 scrollbar-none">
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setActiveLab('console')}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono transition-all flex items-center gap-1 cursor-pointer ${
                  activeLab === 'console'
                    ? 'bg-card text-fg font-bold shadow-sm border border-hairline'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <Home size={12} /> Briefing
              </button>

              <span className="text-fg-muted/30 text-xs">/</span>

              <button
                onClick={() => setActiveLab('campaigns')}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeLab === 'campaigns'
                    ? 'bg-vibe-cyan/15 text-vibe-cyan font-bold border border-vibe-cyan/30 shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-overlay flex items-center justify-center text-[10px] font-mono">1</span>
                <span>Campaign</span>
              </button>

              <span className="text-fg-muted/30 text-xs">➔</span>

              <button
                onClick={() => setActiveLab('simulator1')}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeLab === 'simulator1'
                    ? 'bg-pink-500/15 text-pink-400 font-bold border border-pink-500/30 shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-overlay flex items-center justify-center text-[10px] font-mono">2</span>
                <span>Baseline Sim</span>
              </button>

              <span className="text-fg-muted/30 text-xs">➔</span>

              <button
                onClick={() => setActiveLab('manual_policy')}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeLab === 'manual_policy'
                    ? 'bg-amber-500/15 text-amber-300 font-bold border border-amber-500/30 shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-overlay flex items-center justify-center text-[10px] font-mono">3</span>
                <span>Manual Policy</span>
              </button>

              <span className="text-fg-muted/30 text-xs">➔</span>

              <button
                onClick={() => setActiveLab('simulator2')}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeLab === 'simulator2'
                    ? 'bg-pink-500/15 text-pink-400 font-bold border border-pink-500/30 shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-overlay flex items-center justify-center text-[10px] font-mono">4</span>
                <span>Heuristic Sim</span>
              </button>

              <span className="text-fg-muted/30 text-xs">➔</span>

              <button
                onClick={() => setActiveLab('ai_engineer')}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeLab === 'ai_engineer'
                    ? 'bg-vibe-purple/15 text-vibe-purple font-bold border border-vibe-purple/30 shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-overlay flex items-center justify-center text-[10px] font-mono">5</span>
                <span>AI Engineer</span>
              </button>

              <span className="text-fg-muted/30 text-xs">➔</span>

              <button
                onClick={() => setActiveLab('simulator3')}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeLab === 'simulator3'
                    ? 'bg-pink-500/15 text-pink-400 font-bold border border-pink-500/30 shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-overlay flex items-center justify-center text-[10px] font-mono">6</span>
                <span>Agent Sim</span>
              </button>

              <span className="text-fg-muted/30 text-xs">➔</span>

              <button
                onClick={() => setActiveLab('scorecard')}
                className={`px-2.5 py-1 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeLab === 'scorecard'
                    ? 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30 shadow-sm'
                    : 'text-fg-muted hover:text-fg'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-overlay flex items-center justify-center text-[10px] font-mono">7</span>
                <span>Scorecard</span>
              </button>
            </div>

            <div className="hidden lg:flex items-center gap-2 text-xs font-mono text-fg-muted shrink-0">
              <span className="text-fg-muted/50">Active Phase:</span>
              <span className="text-fg font-semibold">
                {activeLab === 'console' && 'Mission Briefing'}
                {activeLab === 'campaigns' && 'Step 1: Campaign Studio'}
                {activeLab === 'simulator1' && 'Step 2: Baseline Simulation (Attempt 1)'}
                {activeLab === 'manual_policy' && 'Step 3: Manual Policy (Python)'}
                {activeLab === 'simulator2' && 'Step 4: Heuristic Simulation (Attempt 2)'}
                {activeLab === 'ai_engineer' && 'Step 5: AI Data Engineer (ADK 2.0)'}
                {activeLab === 'simulator3' && 'Step 6: Agent Simulation (Attempt 3)'}
                {activeLab === 'scorecard' && 'Step 7: Final Scorecard'}
              </span>
            </div>
          </div>
        </div>
    </nav>
  );
}
