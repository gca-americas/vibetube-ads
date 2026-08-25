import { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Home } from 'lucide-react';
import { Logo } from './Logo';

interface StepItem {
  id: string;
  step: number;
  label: string;
  aliases?: string[];
  activeClass: string;
}

const STEPS: StepItem[] = [
  { id: 'campaigns', step: 1, label: 'Campaign', activeClass: 'bg-vibe-cyan/15 text-vibe-cyan font-bold border-vibe-cyan/30 shadow-sm' },
  { id: 'simulator1', step: 2, label: 'Baseline Sim', aliases: ['simulator'], activeClass: 'bg-pink-500/15 text-pink-400 font-bold border-pink-500/30 shadow-sm' },
  { id: 'manual_policy', step: 3, label: 'Manual Policy', aliases: ['policy'], activeClass: 'bg-amber-500/15 text-amber-300 font-bold border-amber-500/30 shadow-sm' },
  { id: 'simulator2', step: 4, label: 'Heuristic Sim', activeClass: 'bg-pink-500/15 text-pink-400 font-bold border-pink-500/30 shadow-sm' },
  { id: 'ai_engineer', step: 5, label: 'AI Engineer', activeClass: 'bg-vibe-purple/15 text-vibe-purple font-bold border-vibe-purple/30 shadow-sm' },
  { id: 'simulator3', step: 6, label: 'Agent Sim', activeClass: 'bg-pink-500/15 text-pink-400 font-bold border-pink-500/30 shadow-sm' },
  { id: 'scorecard', step: 7, label: 'Scorecard', activeClass: 'bg-emerald-500/15 text-emerald-400 font-bold border-emerald-500/30 shadow-sm' },
];

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

  const activeStepRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.remove('light');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.add('light');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  useEffect(() => {
    if (activeStepRef.current) {
      activeStepRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [activeLab]);

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
        <div className="max-w-7xl mx-auto flex items-center justify-start md:justify-center overflow-x-auto gap-1.5 scrollbar-none py-0.5">
          <button
            onClick={() => setActiveLab('console')}
            ref={activeLab === 'console' ? activeStepRef : null}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border ${
              activeLab === 'console'
                ? 'bg-card text-fg font-bold shadow-sm border-hairline'
                : 'text-fg-muted hover:text-fg border-transparent'
            }`}
          >
            <Home size={13} /> Briefing
          </button>

          <span className="text-fg-muted/30 text-xs shrink-0 px-0.5">/</span>

          {STEPS.map((s, idx) => {
            const isActive = activeLab === s.id || (s.aliases && s.aliases.includes(activeLab || ''));
            return (
              <div key={s.id} className="flex items-center gap-1.5 shrink-0">
                {idx > 0 && <span className="text-fg-muted/30 text-xs px-0.5">➔</span>}
                <button
                  onClick={() => setActiveLab(s.id)}
                  ref={isActive ? activeStepRef : null}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isActive
                      ? s.activeClass
                      : 'text-fg-muted hover:text-fg border-transparent'
                  }`}
                >
                  <span className="w-4 h-4 rounded-full bg-overlay flex items-center justify-center text-[10px] font-mono">
                    {s.step}
                  </span>
                  <span>{s.label}</span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
