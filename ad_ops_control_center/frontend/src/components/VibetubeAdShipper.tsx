import { useState, useEffect } from 'react';
import { 
  Tv, Sparkles, X, CheckCircle2, AlertCircle, 
  ExternalLink, Terminal, Copy, Check, Play, RefreshCw
} from 'lucide-react';

interface VibetubeAdShipperProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTitle?: string;
  defaultBanner?: string;
  creativeUrl?: string;
  campaignId?: string;
}

const SEED_TARGETS = [
  { id: 'seed-synthhorizon', label: 'Midnight Neon Drive (Synthwave Radio)' },
  { id: 'seed-tokyodrifter', label: 'Cyberpunk Alleys at 3 AM' },
  { id: 'seed-escapecolonq', label: 'Switched from VS Code to Vim' },
  { id: 'seed-pixelperfect', label: 'Design Systems: Speed or Prison?' },
];

export default function VibetubeAdShipper({
  isOpen,
  onClose,
  defaultTitle = 'NightGlow Kicks',
  defaultBanner = 'Illuminate your run. Ultra-responsive neon cushioning.',
  creativeUrl = '',
  campaignId = 'camp-default',
}: VibetubeAdShipperProps) {
  const [serviceUrl, setServiceUrl] = useState('https://vibetube.dev');
  const [eventCode, setEventCode] = useState('sandbox');
  const [projectId, setProjectId] = useState('seed-synthhorizon');
  const [customProject, setCustomProject] = useState('');
  const [message, setMessage] = useState('');
  
  const [status, setStatus] = useState<'idle' | 'shipping' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [adResult, setAdResult] = useState<{ id?: string; projectId?: string; status?: string } | null>(null);
  const [verifiedAd, setVerifiedAd] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Initialize ad copy from campaign data
  useEffect(() => {
    const rawMessage = `${defaultTitle}: ${defaultBanner}`.trim();
    setMessage(rawMessage.slice(0, 280));
  }, [defaultTitle, defaultBanner]);

  if (!isOpen) return null;

  const normalizeUrl = (raw: string) => {
    let u = raw.trim().replace(/\/+$/, '');
    if (u && !u.startsWith('http://') && !u.startsWith('https://')) {
      u = `https://${u}`;
    }
    return u;
  };

  const activeEventCode = (eventCode.trim().toUpperCase() === 'SANDBOX' ? 'sandbox' : eventCode.trim()) || 'sandbox';
  const activeProjectId = projectId === 'custom' ? customProject.trim() : projectId;
  const isMessageValid = message.trim().length > 0 && message.length <= 280;
  const isTargetValid = Boolean(activeProjectId);

  // Convert creative URL (data URL or relative asset path) to a File for multipart upload
  const getCreativeFile = async (): Promise<File | null> => {
    if (!creativeUrl) return null;
    try {
      const res = await fetch(creativeUrl);
      const blob = await res.blob();
      return new File([blob], 'ad_creative.png', { type: blob.type || 'image/png' });
    } catch (e) {
      console.warn('Could not package creative image file:', e);
      return null;
    }
  };

  const handleShipAd = async () => {
    if (!isMessageValid || !isTargetValid) return;
    setStatus('shipping');
    setErrorMessage('');
    setAdResult(null);
    setVerifiedAd(null);

    try {
      const formData = new FormData();
      formData.append('projectId', activeProjectId);
      formData.append('message', message.trim());

      const imageFile = await getCreativeFile();
      if (imageFile) {
        formData.append('imageFile', imageFile);
      }

      const cleanServiceUrl = normalizeUrl(serviceUrl);
      const endpoint = `${cleanServiceUrl}/api/events/${encodeURIComponent(activeEventCode)}/ads`;

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let detail = `Server responded with status ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson && errJson.detail) detail = errJson.detail;
        } catch (e) {}
        throw new Error(detail);
      }

      const data = await res.json();
      setAdResult(data);

      // Verify the ad took via GET /api/events/{code}/ads/{projectId} per README
      try {
        const verifyEndpoint = `${cleanServiceUrl}/api/events/${encodeURIComponent(activeEventCode)}/ads/${encodeURIComponent(activeProjectId)}`;
        const checkRes = await fetch(verifyEndpoint);
        if (checkRes.ok) {
          const checkData = await checkRes.json();
          if (checkData && checkData.ad) {
            setVerifiedAd(checkData.ad);
          }
        }
      } catch (verifyErr) {
        console.warn('Ad verification check notice:', verifyErr);
      }

      setStatus('success');
    } catch (err: any) {
      console.error('Failed to ship ad to Vibetube:', err);
      setStatus('error');
      setErrorMessage(
        err?.message || 
        `Could not reach Vibetube at ${serviceUrl}. Ensure the streaming platform backend is running (e.g. on port 8000).`
      );
    }
  };

  // Generate curl command from README spec
  const cleanUrl = normalizeUrl(serviceUrl);
  const curlCommand = `curl -X POST ${cleanUrl}/api/events/${activeEventCode}/ads \\
  -F "projectId=${activeProjectId}" \\
  -F "message=${message.replace(/"/g, '\\"')}"${creativeUrl ? ' \\\n  -F "imageFile=@ad_creative.png"' : ''}`;

  const copyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const showroomUrl = `${cleanUrl}/e/${activeEventCode}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-card border-2 border-vibe-cyan/40 rounded-3xl max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-[0_0_60px_rgba(45,212,191,0.2)] max-h-[92vh] overflow-y-auto relative animate-rise">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-hairline pb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-vibe-cyan/15 border border-vibe-cyan/40 flex items-center justify-center text-vibe-cyan shadow-sm">
              <Tv size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-full bg-vibe-cyan/20 border border-vibe-cyan/30 text-cyan-800 dark:text-vibe-cyan text-[10px] font-mono font-bold uppercase">
                  Vibetube Integration
                </span>
                <span className="text-xs font-mono text-fg-muted">10-Second Pre-Roll</span>
              </div>
              <h2 className="text-xl font-display font-bold text-fg mt-0.5">
                Ship Pre-Roll Ad to Vibetube
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-fg-muted hover:text-fg hover:bg-overlay transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Creative Asset Preview Banner */}
        <div className="p-4 bg-overlay rounded-2xl border border-hairline flex items-center gap-4">
          {creativeUrl ? (
            <img 
              src={creativeUrl} 
              alt="Creative" 
              className="w-20 h-20 rounded-xl object-cover border border-hairline shrink-0 shadow-md"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-vibe-cyan/10 border border-vibe-cyan/20 flex flex-col items-center justify-center text-vibe-cyan shrink-0">
              <Play size={24} />
              <span className="text-[9px] font-mono mt-1 font-bold">10s Ad</span>
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <span className="text-[10px] font-mono font-bold uppercase text-vibe-cyan">
              Winning Creative Asset ({campaignId})
            </span>
            <h4 className="font-bold text-fg text-sm truncate">{defaultTitle}</h4>
            <p className="text-xs text-fg-muted line-clamp-2 leading-relaxed">{defaultBanner}</p>
          </div>
        </div>

        {/* Deployment Configuration Form */}
        <div className="space-y-4">
          {/* Showroom Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-fg flex items-center justify-between">
              <span>Showroom Event Code</span>
              <span className="text-[10px] text-fg-muted font-normal">URL: /e/{activeEventCode}</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={eventCode}
                onChange={e => setEventCode(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-card border border-hairline rounded-xl text-sm font-mono font-bold text-fg focus:border-vibe-cyan focus:outline-none"
                placeholder="sandbox"
              />
              <button
                type="button"
                onClick={() => setEventCode('sandbox')}
                className={`px-3 py-2 text-xs font-mono rounded-xl border transition-all ${
                  activeEventCode === 'sandbox' ? 'bg-vibe-cyan/20 border-vibe-cyan text-cyan-800 dark:text-vibe-cyan font-bold' : 'bg-overlay border-hairline text-fg-muted'
                }`}
              >
                sandbox
              </button>
              <button
                type="button"
                onClick={() => setEventCode('SUMMIT')}
                className={`px-3 py-2 text-xs font-mono rounded-xl border transition-all ${
                  activeEventCode === 'SUMMIT' ? 'bg-vibe-cyan/20 border-vibe-cyan text-cyan-800 dark:text-vibe-cyan font-bold' : 'bg-overlay border-hairline text-fg-muted'
                }`}
              >
                SUMMIT
              </button>
            </div>
          </div>

          {/* Target Project ID / Matching Video */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-fg flex items-center justify-between">
              <span>Target Video Identifier (projectId)</span>
              <span className="text-[10px] text-fg-muted font-normal">Matches video.projectId</span>
            </label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-card border border-hairline rounded-xl text-xs font-mono font-medium text-fg focus:border-vibe-cyan focus:outline-none"
            >
              {SEED_TARGETS.map(t => (
                <option key={t.id} value={t.id}>
                  {t.id} — {t.label}
                </option>
              ))}
              <option value="custom">Custom project ID...</option>
            </select>
            {projectId === 'custom' && (
              <input
                type="text"
                value={customProject}
                onChange={e => setCustomProject(e.target.value)}
                placeholder="Enter existing video projectId"
                className="w-full mt-2 px-3.5 py-2 bg-card border border-hairline rounded-xl text-xs font-mono text-fg focus:border-vibe-cyan focus:outline-none"
              />
            )}
          </div>

          {/* Ad Copy (Max 280 chars) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-bold text-fg">
                Ad Message / Copy (Max 280 chars)
              </label>
              <span className={`text-[11px] font-mono ${message.length > 280 ? 'text-red-400 font-bold' : 'text-fg-muted'}`}>
                {message.length} / 280
              </span>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={2}
              maxLength={280}
              className="w-full px-3.5 py-2.5 bg-card border border-hairline rounded-xl text-xs font-sans text-fg focus:border-vibe-cyan focus:outline-none resize-none leading-relaxed"
              placeholder="NightGlow Kicks — Illuminate your run. Own the night."
            />
          </div>

          {/* Vibetube Streaming Platform URL */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-bold text-fg flex items-center justify-between">
              <span>Vibetube Platform URL</span>
              <span className="text-[10px] text-fg-muted font-normal">Local dev or Cloud Run URL</span>
            </label>
            <input
              type="text"
              value={serviceUrl}
              onChange={e => setServiceUrl(e.target.value)}
              className="w-full px-3.5 py-2 bg-card border border-hairline rounded-xl text-xs font-mono text-fg focus:border-vibe-cyan focus:outline-none"
              placeholder="https://vibetube.dev"
            />
          </div>
        </div>

        {/* Success Alert */}
        {status === 'success' && adResult && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-3 animate-rise">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 size={18} />
                <span>Pre-Roll Ad Successfully Deployed!</span>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                {verifiedAd?.durationSeconds ? `${verifiedAd.durationSeconds}s Duration Verified` : '10s Duration Verified'}
              </span>
            </div>
            
            <p className="text-xs text-fg-muted leading-relaxed">
              Ad <code className="font-mono text-fg font-bold">{adResult.id}</code> is attached to video <code className="font-mono text-fg font-bold">{activeProjectId}</code> in showroom <code className="font-mono text-fg font-bold">{activeEventCode}</code>. It will play for 10 seconds before the video begins.
            </p>

            <div className="flex items-center gap-3 pt-1">
              <a
                href={showroomUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-black font-bold text-xs rounded-xl transition-all flex items-center gap-2 shadow-md cursor-pointer"
              >
                <span>🍿 Open Showroom &amp; Watch Ad</span>
                <ExternalLink size={14} />
              </a>
              <button
                onClick={() => setStatus('idle')}
                className="px-3 py-2 bg-overlay hover:bg-hairline text-fg text-xs rounded-xl border border-hairline font-medium transition-all"
              >
                Re-submit
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {status === 'error' && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl space-y-2 text-xs animate-rise">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertCircle size={16} />
              <span>Deployment Notice</span>
            </div>
            <p className="text-fg-muted leading-relaxed">{errorMessage}</p>
            <p className="text-[11px] text-fg-muted/80">
              Tip: You can start Vibetube locally by running <code className="font-mono bg-overlay px-1 py-0.5 rounded">./dev.sh</code> or <code className="font-mono bg-overlay px-1 py-0.5 rounded">python backend/main.py</code> in the <code className="font-mono bg-overlay px-1 py-0.5 rounded">vibetube-streaming-platform</code> repository.
            </p>
          </div>
        )}

        {/* Command Line curl Preview per README spec */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-fg-muted font-mono">
            <span className="flex items-center gap-1.5">
              <Terminal size={14} /> API Wire Call (<code className="text-cyan-700 dark:text-vibe-cyan">POST /api/events/{eventCode}/ads</code>)
            </span>
            <button
              type="button"
              onClick={copyCurl}
              className="flex items-center gap-1 text-[11px] hover:text-fg transition-all text-fg-muted cursor-pointer"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? 'Copied' : 'Copy cURL'}</span>
            </button>
          </div>
          <pre className="p-3 bg-black/60 rounded-xl border border-hairline/60 text-[11px] font-mono text-fg-muted overflow-x-auto leading-relaxed">
            {curlCommand}
          </pre>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-hairline">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-xs font-medium text-fg-muted hover:text-fg bg-overlay hover:bg-hairline border border-hairline transition-all"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handleShipAd}
            disabled={status === 'shipping' || !isMessageValid || !isTargetValid}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg ${
              status === 'shipping' || !isMessageValid || !isTargetValid
                ? 'bg-overlay text-fg-muted/40 border border-hairline cursor-not-allowed'
                : 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black shadow-vibe-cyan/20 cursor-pointer'
            }`}
          >
            {status === 'shipping' ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Publishing to Vibetube...</span>
              </>
            ) : (
              <>
                <span>🚀 Ship Pre-Roll Ad</span>
                <Sparkles size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
