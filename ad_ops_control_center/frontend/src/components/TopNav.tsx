import { useState, useEffect } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Logo } from './Logo';

export default function TopNav({ setActiveLab }: { activeLab?: string, setActiveLab: (id: string) => void }) {
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
      <div className="max-w-7xl mx-auto px-4 md:px-8 h-20 flex items-center justify-between">
        <div 
          className="flex items-center cursor-pointer group"
          onClick={() => setActiveLab('entry')}
        >
          <Logo theme={isDark ? 'dark' : 'light'} shine={false} className="w-[140px] drop-shadow-2xl transition-transform group-hover:scale-105" />
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center space-x-2 mr-4 bg-overlay px-4 py-2 rounded-full border border-hairline">
             <span className="w-2 h-2 rounded-full bg-vibe-cyan animate-pulse" />
             <span className="text-xs font-bold tracking-widest uppercase text-fg-muted">Engine Online</span>
          </div>
          
          <button 
            onClick={() => setIsDark(!isDark)}
            className="p-2 hover:opacity-80 transition-all flex items-center justify-center cursor-pointer rounded-lg"
            title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
            aria-label="Toggle Theme"
          >
            {isDark ? (
              <Sun className="w-6 h-6 text-[#fdba12]" />
            ) : (
              <Moon className="w-6 h-6 text-[#6362f9]" />
            )}
          </button>
        </div>
      </div>
    </nav>
  );
}
