import { ArrowRight, Sparkles } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

export default function Console({ navigate }: { navigate: (view: string) => void }) {
    const { t } = useTranslation();
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] max-w-5xl mx-auto animate-rise space-y-10 py-8 px-4">
            {/* Hero Narrative Section */}
            <div className="text-center space-y-5 max-w-3xl">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-100 dark:bg-vibe-cyan/10 border border-cyan-300 dark:border-vibe-cyan/25 text-cyan-950 dark:text-vibe-cyan text-sm font-mono font-bold tracking-wide">
                    <Sparkles size={15} />
                    <span>ADK 2.0 · Gemini · BigQuery</span>
                </div>

                <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-fg leading-tight">
                    {t('console.title')}
                </h1>

                <p className="text-fg-muted text-base md:text-lg leading-relaxed">
                    <Trans
                        i18nKey="console.mission"
                        components={{
                            agent: <strong className="text-fg font-semibold" />,
                            adk: <strong className="text-cyan-800 dark:text-vibe-cyan font-bold" />,
                            gemini: <strong className="text-purple-800 dark:text-vibe-purple font-bold" />,
                            code: <code className="font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline text-fg" />,
                        }}
                    />
                </p>
            </div>

            {/* Single Primary Action Button */}
            <div className="flex flex-col items-center gap-3 pt-1">
                <button
                    onClick={() => navigate('campaigns')}
                    className="px-10 py-4 bg-cyan-500 hover:bg-cyan-400 dark:bg-vibe-cyan dark:hover:bg-vibe-cyan/90 text-slate-950 font-bold text-base rounded-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 flex items-center gap-3 cursor-pointer group"
                >
                    <span>{t('console.startLab')}</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <span className="text-sm font-mono text-fg-muted tracking-wide">
                    {t('console.labSummary')}
                </span>
            </div>
        </div>
    );
}
