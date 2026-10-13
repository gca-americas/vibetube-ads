import { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Home, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Logo } from './Logo';
import { LANGUAGES } from '../i18n';

interface StepItem {
    id: string;
    step: number;
    aliases?: string[];
    activeClass: string;
}

const HIGH_CONTRAST_ACTIVE = 'bg-card text-fg border-hairline shadow-sm font-semibold';

const STEPS: StepItem[] = [
    { id: 'campaigns', step: 1, activeClass: HIGH_CONTRAST_ACTIVE },
    { id: 'simulator1', step: 2, aliases: ['simulator'], activeClass: HIGH_CONTRAST_ACTIVE },
    { id: 'manual_policy', step: 3, aliases: ['data_exploration', 'policy', 'simulator2'], activeClass: HIGH_CONTRAST_ACTIVE },
    { id: 'ai_engineer', step: 4, aliases: ['agent_execution'], activeClass: HIGH_CONTRAST_ACTIVE },
    { id: 'adk_eval', step: 5, activeClass: HIGH_CONTRAST_ACTIVE },
    { id: 'judge_agent', step: 6, activeClass: HIGH_CONTRAST_ACTIVE },
    { id: 'flywheel', step: 7, aliases: ['wire_loop', 'workflow', 'wire_flywheel', 'optimize_loop', 'simulator3'], activeClass: HIGH_CONTRAST_ACTIVE },
    { id: 'scorecard', step: 8, activeClass: HIGH_CONTRAST_ACTIVE },
];

export default function TopNav({ activeLab, setActiveLab }: { activeLab?: string, setActiveLab: (id: string) => void }) {
    const { t, i18n } = useTranslation();
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
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
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
            <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between gap-3">
                <div
                    className="flex items-center cursor-pointer group shrink-0"
                    onClick={() => setActiveLab('console')}
                >
                    <Logo theme={isDark ? 'dark' : 'light'} shine={false} className="w-[92px] drop-shadow-md transition-transform group-hover:scale-105" />
                </div>

                {/* Lab Flow & Step Navigation */}
                <div className="flex items-center justify-center overflow-x-auto gap-1.5 scrollbar-none py-1 mx-2">
                    <button
                        onClick={() => setActiveLab('console')}
                        ref={activeLab === 'console' ? activeStepRef : null}
                        title={t('topNav.briefingTitle')}
                        className={`transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0 border ${activeLab === 'console'
                                ? 'px-3.5 py-1.5 rounded-xl text-sm bg-card text-fg font-semibold shadow-sm border-hairline'
                                : 'w-8 h-8 rounded-xl text-fg-muted hover:text-fg hover:bg-overlay border-transparent'
                            }`}
                    >
                        <Home size={15} />
                        {activeLab === 'console' && <span>{t('topNav.briefing')}</span>}
                    </button>

                    <span className="text-fg-muted/30 text-xs shrink-0 px-0.5">/</span>

                    {STEPS.map((s, idx) => {
                        const label = t(`topNav.steps.${s.id}`);
                        const isActive = activeLab === s.id || (s.aliases && s.aliases.includes(activeLab || ''));
                        return (
                            <div key={s.id} className="flex items-center gap-1.5 shrink-0">
                                {idx > 0 && <span className="text-fg-muted/25 text-xs px-0.5">➔</span>}
                                <button
                                    onClick={() => setActiveLab(s.id)}
                                    ref={isActive ? activeStepRef : null}
                                    title={t('topNav.stepTitle', { step: s.step, label })}
                                    className={`transition-all flex items-center justify-center gap-1.5 cursor-pointer border ${isActive
                                            ? `px-3.5 py-1.5 rounded-xl text-sm font-semibold ${s.activeClass}`
                                            : 'w-8 h-8 rounded-full text-xs font-semibold text-slate-700 hover:text-slate-950 bg-slate-100/90 hover:bg-slate-200 border-slate-300 dark:text-fg-muted dark:hover:text-fg dark:bg-overlay/60 dark:hover:bg-hairline dark:border-hairline hover:scale-105'
                                        }`}
                                >
                                    <span className={isActive ? 'w-5 h-5 rounded-full bg-fg/10 text-fg flex items-center justify-center text-xs font-bold' : ''}>
                                        {s.step}
                                    </span>
                                    {isActive && <span className="whitespace-nowrap">{label}</span>}
                                </button>
                            </div>
                        );
                    })}
                </div>

                <div className="flex items-center space-x-3 shrink-0">
                    <label className="relative flex items-center gap-1.5 text-fg-muted hover:text-fg transition-colors cursor-pointer" title={t('topNav.language')}>
                        <Languages className="w-4 h-4 shrink-0" />
                        <select
                            value={i18n.resolvedLanguage}
                            onChange={e => i18n.changeLanguage(e.target.value)}
                            aria-label={t('topNav.language')}
                            className="bg-transparent text-sm font-medium cursor-pointer focus:outline-none appearance-none pr-1"
                        >
                            {LANGUAGES.map(l => (
                                <option key={l.code} value={l.code} className="bg-card text-fg">{l.label}</option>
                            ))}
                        </select>
                    </label>
                    <button
                        onClick={() => setIsDark(!isDark)}
                        className="p-2 hover:opacity-80 transition-all flex items-center justify-center cursor-pointer rounded-lg"
                        title={isDark ? t('topNav.switchToLight') : t('topNav.switchToDark')}
                        aria-label={t('topNav.toggleTheme')}
                    >
                        {isDark ? (
                            <Sun className="w-5 h-5 text-[#fdba12]" />
                        ) : (
                            <Moon className="w-5 h-5 text-[#6362f9]" />
                        )}
                    </button>
                </div>
            </div>
        </nav>
    );
}
