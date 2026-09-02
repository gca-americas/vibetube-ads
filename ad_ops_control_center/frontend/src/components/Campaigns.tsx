import { useState, useEffect } from 'react';
import { 
  Play, Image as ImageIcon, 
  Sparkles
} from 'lucide-react';
import { generateAdImageFromPrompt } from '../lib/adCreativeGenerator';

export default function Campaigns({ 
  navigate, 
}: { 
  navigate: (v: string) => void; 
  setActiveLab?: (v: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [generatingCreative, setGeneratingCreative] = useState(false);

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
    } catch (e) {
      console.error('Creative generation error:', e);
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
          name: formData.name || 'Vibetube Video Campaign',
          creative_url: formData.creativeUrl || '/images/creatives/sneaker.jpg',
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
      {/* Page Title & Save Action */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-display font-bold text-fg">Campaign Studio</h1>
        </div>

        <div className="flex items-center gap-3">
          {!formData.creativeUrl && (
            <span className="text-xs font-mono text-fg-muted hidden sm:inline-block">
              Generate creative to launch campaign
            </span>
          )}
          <button
            onClick={handleSaveCampaign}
            disabled={saving || !formData.creativeUrl}
            title={!formData.creativeUrl ? 'Generate ad creative first to launch campaign' : 'Launch Campaign'}
            className={`px-7 py-3 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
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
                <h3 className="font-display font-bold text-lg text-fg">Creative Asset Studio</h3>
                <p className="text-xs text-fg-muted">Design your video ad banner & generate visual assets.</p>
              </div>
            </div>

            {/* AI Creative Prompt (Prominent & Full Width at Top) */}
            <div className="space-y-3 p-5 bg-overlay rounded-2xl border border-hairline">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-vibe-cyan flex items-center gap-1.5">
                  <Sparkles size={14} /> AI Creative Prompt (Gemini & Imagen 3)
                </label>
                <span className="text-[11px] font-mono text-fg-muted">Vertex AI Connected</span>
              </div>
              
              <textarea
                value={formData.creativePrompt}
                onChange={e => updateForm({ creativePrompt: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 bg-card border border-hairline rounded-xl text-sm font-medium focus:border-vibe-cyan focus:outline-none resize-none leading-relaxed placeholder:text-fg-muted/50"
                placeholder="Futuristic glowing neon sneakers for urban night runners"
              />

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                {!hasPrompt ? (
                  <span className="text-[11px] font-mono text-fg-muted">
                    ⌨️ Enter your product concept prompt above to enable generation
                  </span>
                ) : (
                  <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 font-medium">
                    ✓ Prompt ready to synthesize
                  </span>
                )}

                <button
                  type="button"
                  onClick={handleGenerateCreative}
                  disabled={generatingCreative || !hasPrompt}
                  className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap self-end sm:self-auto ${
                    hasPrompt && !generatingCreative
                      ? 'bg-vibe-purple hover:bg-vibe-purple/90 text-white shadow-[0_0_20px_rgba(168,85,247,0.3)] cursor-pointer'
                      : 'bg-overlay text-fg-muted/60 border border-hairline cursor-not-allowed opacity-50'
                  }`}
                >
                  <Sparkles size={15} className={generatingCreative ? 'animate-spin' : ''} />
                  <span>{generatingCreative ? 'Synthesizing with Vertex AI...' : '✨ Generate Creative & Copy'}</span>
                </button>
              </div>
            </div>

            {/* Campaign Name */}
            <div className="space-y-2">
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-fg-muted">
                Campaign Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={e => updateForm({ name: e.target.value })}
                className="w-full px-4 py-3 bg-overlay border border-hairline rounded-xl text-sm font-medium focus:border-vibe-cyan focus:outline-none"
                placeholder="e.g. Neon Runner Launch"
              />
            </div>

            {/* Headline & Banner Copy */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-fg-muted">
                  Ad Headline
                </label>
                <input
                  type="text"
                  value={formData.creativeTitle}
                  onChange={e => updateForm({ creativeTitle: e.target.value })}
                  className="w-full px-4 py-3 bg-overlay border border-hairline rounded-xl text-sm font-medium focus:border-vibe-cyan focus:outline-none"
                  placeholder="e.g. Neon Runner Pro"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-fg-muted">
                  Tagline / Call to Action
                </label>
                <input
                  type="text"
                  value={formData.creativeBanner}
                  onChange={e => updateForm({ creativeBanner: e.target.value })}
                  className="w-full px-4 py-3 bg-overlay border border-hairline rounded-xl text-sm font-medium focus:border-vibe-cyan focus:outline-none"
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
              <span className="text-xs font-mono font-bold uppercase tracking-wider text-fg-muted block">
                Vibetube In-Stream Video Ad Card
              </span>
              {formData.creativeUrl ? (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold flex items-center gap-1">
                  ✓ Live Preview
                </span>
              ) : (
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-overlay text-fg-muted border border-hairline">
                  Awaiting Creative
                </span>
              )}
            </div>

            <div className="bg-black/40 rounded-2xl overflow-hidden border border-hairline p-4 space-y-3">
              <div className="aspect-video w-full rounded-xl overflow-hidden bg-overlay flex items-center justify-center relative">
                {formData.creativeUrl ? (
                  <>
                    <img src={formData.creativeUrl} alt="Ad preview" className="w-full h-full object-cover" />
                    <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded bg-black/70 text-[10px] font-mono text-white">
                      Sponsored Ad
                    </span>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center p-6 space-y-2">
                    <div className="w-12 h-12 rounded-2xl bg-overlay border border-hairline flex items-center justify-center text-fg-muted">
                      <ImageIcon size={22} className="opacity-40" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs font-mono font-bold text-fg-muted uppercase tracking-wider block">
                        No Creative Generated
                      </span>
                      <p className="text-[11px] font-sans text-fg-muted/80 max-w-[240px] leading-relaxed">
                        Enter a prompt on the left and click &ldquo;Generate Creative &amp; Copy&rdquo; to synthesize your campaign ad.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <h4 className="text-sm font-bold text-fg">
                  {formData.creativeTitle || (
                    <span className="text-fg-muted italic">Awaiting Ad Headline...</span>
                  )}
                </h4>
                <p className="text-xs text-fg-muted mt-0.5">
                  {formData.creativeBanner || (
                    <span className="text-fg-muted/60 italic">Awaiting ad description and call-to-action copy.</span>
                  )}
                </p>
              </div>
            </div>

            <p className="text-xs text-fg-muted font-sans leading-relaxed">
              This ad creative will be dynamically rendered into winning video ad slots on Vibetube whenever your active bidding policy wins the first-price auction.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
