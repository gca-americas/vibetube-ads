import { useState, useEffect } from 'react';
import { 
  Play, Image as ImageIcon, 
  Sparkles, CheckCircle2
} from 'lucide-react';
import { generateAdImageFromPrompt } from '../lib/adCreativeGenerator';

export default function Campaigns({ 
  navigate, 
}: { 
  navigate: (v: string) => void; 
}) {
  const [saving, setSaving] = useState(false);
  const [generatingCreative, setGeneratingCreative] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Single Campaign Configuration State (Starts empty awaiting student prompt)
  const [formData, setFormData] = useState({
    id: 'camp-default',
    name: '',
    creativePrompt: '',
    creativeTitle: '',
    creativeBanner: '',
    creativeUrl: '',
    budget: 2500.0,
    bidCpm: 2.50,
    maxBidCeiling: 10.00,
  });

  const hasPrompt = formData.creativePrompt.trim().length >= 8;

  // Fetch campaign config from server on mount
  useEffect(() => {
    fetchCampaignConfig();
  }, []);

  const fetchCampaignConfig = async () => {
    try {
      const res = await fetch('/campaign/config');
      if (res.ok) {
        const data = await res.json();
        if (data) {
          // Only sync financial/runtime parameters; preserve blank creative awaiting student input
          setFormData(prev => ({
            ...prev,
            id: data.id || prev.id,
            budget: Number((data.total_budget ?? data.budget_remaining ?? prev.budget).toFixed(2)),
            bidCpm: Number((data.base_bid_cpm ?? 2.50).toFixed(2)),
            maxBidCeiling: Number((data.max_bid_ceiling ?? prev.maxBidCeiling).toFixed(2)),
          }));
        }
      }
    } catch (e) {
      console.warn('Failed to load campaign config:', e);
    }
  };

  const updateForm = (patch: Partial<typeof formData>) => {
    setFormData(prev => ({ ...prev, ...patch }));
  };

  const handleGenerateCreative = async () => {
    if (!hasPrompt) return;
    setGeneratingCreative(true);
    setGenerationError(null);
    try {
      const res = await generateAdImageFromPrompt(formData.creativePrompt);
      const generatedName = res.title ? `${res.title} Campaign` : (formData.name || 'Ad Campaign');
      setFormData(prev => ({
        ...prev,
        name: generatedName,
        creativeUrl: res.imageUrl,
        creativeTitle: res.title,
        creativeBanner: res.tagline,
      }));
    } catch (e: any) {
      console.error('Creative generation error:', e);
      setGenerationError(e?.message || 'Failed to synthesize creative with Google Enterprise Agent Platform.');
    } finally {
      setGeneratingCreative(false);
    }
  };

  const handleSaveCampaign = async () => {
    if (!formData.creativeUrl) return;
    setSaving(true);
    try {
      const campId = formData.id || 'camp-default';
      
      await fetch('/campaign/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: campId,
          name: formData.name || 'Vibetube Ad Campaign',
          creative_url: formData.creativeUrl || '',
          creative_title: formData.creativeTitle || 'Campaign Creative',
          creative_banner: formData.creativeBanner || 'Live ad flight',
          budget: formData.budget,
          bid_cpm: formData.bidCpm,
          max_bid_ceiling: formData.maxBidCeiling,
        }),
      });
    } catch (e) {
      console.warn('Notice: /campaign/setup request error:', e);
    } finally {
      setSaving(false);
      // Guaranteed navigation to Step 3 so student is never blocked
      navigate('simulator1');
    }
  };

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* 2-Column Form Layout: Creative Studio & Ad Preview Card */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Creative Studio & Gemini Imagen Generator */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-7 bg-card border border-hairline rounded-3xl shadow-xl space-y-6">
            <div className="flex items-center gap-3 border-b border-hairline pb-4">
              <div className="p-2.5 bg-vibe-cyan/10 text-vibe-cyan rounded-2xl">
                <ImageIcon size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-fg">Creative Asset Studio</h3>
                <p className="text-sm text-fg-muted">Design your ad banner & generate visual assets.</p>
              </div>
            </div>

            {/* AI Creative Prompt (Prominent & Full Width at Top) */}
            <div className="space-y-3 p-5 bg-overlay rounded-2xl border border-hairline">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-semibold text-cyan-900 dark:text-vibe-cyan flex items-center gap-2">
                  <Sparkles size={15} /> AI Creative Prompt (Gemini 3.5 Flash Lite & Gemini 3.1 Flash Image)
                </label>
              </div>
              
              <textarea
                value={formData.creativePrompt}
                onChange={e => {
                  setGenerationError(null);
                  updateForm({ creativePrompt: e.target.value });
                }}
                rows={3}
                className="w-full px-4 py-3 bg-card border border-hairline rounded-xl text-sm font-normal focus:border-vibe-cyan focus:outline-none resize-none leading-relaxed placeholder:text-fg-muted/60"
                placeholder="A portable energy food processor for busy robots on the go"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                {generationError && (
                  <span className="text-xs text-red-500 font-medium">
                    ⚠️ {generationError}
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleGenerateCreative}
                  disabled={generatingCreative || !hasPrompt}
                  className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 whitespace-nowrap self-end sm:self-auto sm:ml-auto ${
                    hasPrompt && !generatingCreative
                      ? 'bg-vibe-purple hover:bg-vibe-purple/90 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] cursor-pointer'
                      : 'bg-overlay text-fg-muted/60 border border-hairline cursor-not-allowed opacity-50'
                  }`}
                >
                  <Sparkles size={16} className={generatingCreative ? 'animate-spin' : ''} />
                  <span>{generatingCreative ? 'Synthesizing with Google Enterprise Agent Platform...' : 'Generate Creative & Copy'}</span>
                </button>
              </div>
            </div>

            {/* Campaign Name */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-fg">
                Campaign Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => updateForm({ name: e.target.value })}
                className="w-full px-4 py-3 bg-overlay border border-hairline rounded-xl text-sm font-normal focus:border-vibe-cyan focus:outline-none"
                placeholder="e.g. RoboBlend Energy Launch"
              />
            </div>

            {/* Headline & Banner Copy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-fg">
                  Ad Headline
                </label>
                <input
                  type="text"
                  value={formData.creativeTitle}
                  onChange={e => updateForm({ creativeTitle: e.target.value })}
                  className="w-full px-4 py-3 bg-overlay border border-hairline rounded-xl text-sm font-normal focus:border-vibe-cyan focus:outline-none"
                  placeholder="e.g. Neon Runner Pro"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-fg">
                  Tagline / Call to Action
                </label>
                <input
                  type="text"
                  value={formData.creativeBanner}
                  onChange={e => updateForm({ creativeBanner: e.target.value })}
                  className="w-full px-4 py-3 bg-overlay border border-hairline rounded-xl text-sm font-normal focus:border-vibe-cyan focus:outline-none"
                  placeholder="e.g. Responsive neon cushioning with kinetic energy return."
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Ad Preview Card */}
        <div className="lg:col-span-5 space-y-6">
          {/* Ad Card Live Preview */}
          <div className="p-7 bg-card border border-hairline rounded-3xl shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-4">
              <span className="text-sm font-semibold text-fg-muted block">
                Vibetube In-Stream Ad Card
              </span>
              {formData.creativeUrl ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950/50 border border-emerald-300 dark:border-emerald-600/40 text-emerald-950 dark:text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 size={14} className="text-emerald-700 dark:text-emerald-400 shrink-0 stroke-[2.5]" />
                  <span>Live Preview</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-overlay text-slate-600 dark:text-fg-muted border border-slate-300 dark:border-hairline text-xs font-semibold">
                  <span>Awaiting Creative</span>
                </span>
              )}
            </div>

            <div className="bg-slate-100 dark:bg-slate-900/80 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 p-4 space-y-3 shadow-inner">
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-200/80 dark:bg-slate-800/80 flex items-center justify-center relative border border-slate-200/60 dark:border-white/5">
                {formData.creativeUrl ? (
                  <>
                    <img src={formData.creativeUrl} alt="Ad preview" className="w-full h-full object-cover" />
                    <span className="absolute bottom-2 left-2 px-2.5 py-1 rounded bg-black/70 text-xs font-medium text-white">
                      Sponsored Ad
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-400 dark:text-slate-400 shadow-sm">
                      <ImageIcon size={22} className="opacity-70" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 block">
                        No Creative Generated
                      </span>
                      <p className="text-xs text-slate-500 dark:text-slate-400 max-w-[260px] leading-relaxed">
                        Enter a prompt on the left and click &ldquo;Generate Creative &amp; Copy&rdquo; to synthesize your campaign ad.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900 dark:text-white">
                  {formData.creativeTitle || (
                    <span className="text-slate-400 dark:text-slate-500 italic font-normal">Awaiting Ad Headline...</span>
                  )}
                </h4>
                <p className="text-sm text-slate-700 dark:text-slate-300 mt-1">
                  {formData.creativeBanner || (
                    <span className="text-slate-400 dark:text-slate-500 italic">Awaiting ad description and call-to-action copy.</span>
                  )}
                </p>
              </div>
            </div>

            <p className="text-sm text-fg-muted leading-relaxed">
              This ad creative will be dynamically rendered into winning ad slots on Vibetube whenever your active bidding policy wins the first-price auction.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Action: Launch Campaign & Proceed to Step 2 */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-6 bg-card border border-hairline rounded-3xl shadow-xl">
        <div className="space-y-0.5 text-center sm:text-left">
          <h3 className="text-lg font-bold text-fg">
            {formData.creativeUrl ? 'Campaign Ready to Launch' : 'Awaiting Campaign Creative'}
          </h3>
          <p className="text-sm text-fg-muted">
            {formData.creativeUrl 
              ? 'Creative & copy synthesized. Launch campaign into the auction engine to proceed.' 
              : 'Enter a product concept on the left and click "Generate Creative & Copy" to synthesize assets.'}
          </p>
        </div>

        <button
          onClick={handleSaveCampaign}
          disabled={saving || !formData.creativeUrl}
          title={!formData.creativeUrl ? 'Generate ad creative first to launch campaign' : 'Launch Campaign'}
          className={`px-8 py-3.5 rounded-2xl text-sm font-bold transition-all flex items-center gap-2.5 shrink-0 ${
            formData.creativeUrl && !saving
              ? 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black shadow-lg hover:shadow-vibe-cyan/20 cursor-pointer'
              : 'bg-overlay text-fg-muted/60 border border-hairline cursor-not-allowed opacity-50'
          }`}
        >
          {saving ? (
            <>
              <Sparkles size={16} className="animate-spin" /> Deploying Campaign...
            </>
          ) : (
            <>
              <span>🚀 Launch Campaign</span>
              <Play size={15} fill="currentColor" />
            </>
          )}
        </button>
      </div>
    </div>
  );
}
