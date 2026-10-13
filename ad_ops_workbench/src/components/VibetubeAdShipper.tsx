import { useState, useEffect } from 'react';
import { 
  Tv, Sparkles, X, CheckCircle2, AlertCircle, 
  ExternalLink, Terminal, Copy, Check, Play, RefreshCw
} from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';

interface VibetubeAdShipperProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTitle?: string;
  defaultBanner?: string;
  creativeUrl?: string;
  campaignId?: string;
  defaultProjectId?: string;
  defaultEventCode?: string;
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
  defaultProjectId,
  defaultEventCode,
}: VibetubeAdShipperProps) {
  const { t } = useTranslation();
  const [serviceUrl, setServiceUrl] = useState(
    typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://localhost:8000'
      : 'https://vibetube.dev'
  );
  const [eventCode, setEventCode] = useState(defaultEventCode || '');
  const [projectId, setProjectId] = useState(defaultProjectId || '');
  const [customProject, setCustomProject] = useState('');
  const [message, setMessage] = useState('');

  // Update props if they change
  useEffect(() => {
    if (defaultEventCode) {
      setEventCode(defaultEventCode);
    }
  }, [defaultEventCode]);

  useEffect(() => {
    if (defaultProjectId) {
      setProjectId(defaultProjectId);
    }
  }, [defaultProjectId]);
  
  const [status, setStatus] = useState<'idle' | 'shipping' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [adResult, setAdResult] = useState<{ id?: string; projectId?: string; status?: string } | null>(null);
  const [verifiedAd, setVerifiedAd] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  // Initialize ad copy from campaign data
  useEffect(() => {
    if (isOpen || !message) {
      const rawMessage = `${defaultTitle}: ${defaultBanner}`.trim();
      setMessage(rawMessage.slice(0, 280));
    }
  }, [isOpen, defaultTitle, defaultBanner]);

  if (!isOpen) return null;

  const normalizeUrl = (raw: string) => {
    let u = raw.trim().replace(/\/+$/, '');
    if (u && !u.startsWith('http://') && !u.startsWith('https://')) {
      u = `https://${u}`;
    }
    return u;
  };

  const activeEventCode = eventCode.trim();
  const activeProjectId = projectId === 'custom' ? customProject.trim() : projectId;
  const isMessageValid = message.trim().length > 0 && message.length <= 280;
  const isTargetValid = Boolean(activeProjectId);

  // Convert creative data URL to a File for multipart upload
  const getCreativeFile = async (): Promise<File | null> => {
    if (!creativeUrl) return null;
    try {
      if (creativeUrl.startsWith('data:')) {
        const parts = creativeUrl.split(',');
        const mimeMatch = parts[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) {
          u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], 'ad_creative.png', { type: mime });
      }
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
      const targetEventCode = activeEventCode.trim();
      if (!targetEventCode) {
        throw new Error(t('vibetubeAdShipper.errors.eventNotConfigured'));
      }
      const endpoint = `${cleanServiceUrl}/api/events/${encodeURIComponent(targetEventCode)}/ads`;

      const res = await fetch(endpoint, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let detail = t('vibetubeAdShipper.errors.serverStatus', { status: res.status });
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
        t('vibetubeAdShipper.errors.unreachable', { url: serviceUrl })
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
                <span className="px-2.5 py-0.5 rounded-full bg-vibe-cyan/20 border border-vibe-cyan/30 text-cyan-800 dark:text-vibe-cyan text-xs font-semibold uppercase">
                  {t('vibetubeAdShipper.integration')}
                </span>
                <span className="text-xs font-mono text-fg-muted">{t('vibetubeAdShipper.preRoll')}</span>
              </div>
              <h2 className="text-xl font-bold text-fg mt-0.5">
                {t('vibetubeAdShipper.title')}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            title={t('vibetubeAdShipper.close')}
            aria-label={t('vibetubeAdShipper.close')}
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
              alt={t('vibetubeAdShipper.creativeAlt')} 
              className="w-20 h-20 rounded-xl object-cover border border-hairline shrink-0 shadow-md"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-vibe-cyan/10 border border-vibe-cyan/20 flex flex-col items-center justify-center text-vibe-cyan shrink-0">
              <Play size={24} />
              <span className="text-xs font-mono mt-1 font-bold">{t('vibetubeAdShipper.tenSecAd')}</span>
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
            <span className="text-xs font-semibold uppercase text-cyan-800 dark:text-vibe-cyan">
              {t('vibetubeAdShipper.winningCreative', { id: campaignId })}
            </span>
            <h4 className="font-bold text-fg text-sm truncate">{defaultTitle}</h4>
            <p className="text-sm text-fg-muted line-clamp-2 leading-relaxed font-sans">{defaultBanner}</p>
          </div>
        </div>

        {/* Deployment Configuration Form */}
        <div className="space-y-4">
          {/* Showroom Code */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-fg flex items-center justify-between">
              <span>{t('vibetubeAdShipper.eventCodeLabel')}</span>
              <span className="text-xs text-fg-muted font-normal font-mono">URL: /e/{activeEventCode}</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={eventCode}
                onChange={e => setEventCode(e.target.value)}
                className="flex-1 px-3.5 py-2.5 bg-card border border-hairline rounded-xl text-sm font-mono font-bold text-fg focus:border-vibe-cyan focus:outline-none"
                placeholder="GoogleSLUTest"
              />
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
            <label className="text-sm font-semibold text-fg flex items-center justify-between">
              <span>{t('vibetubeAdShipper.projectLabel')}</span>
              <span className="text-xs text-fg-muted font-normal font-mono">{t('vibetubeAdShipper.projectHint')}</span>
            </label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-card border border-hairline rounded-xl text-sm font-mono text-fg focus:border-vibe-cyan focus:outline-none"
            >
              {!defaultProjectId && (
                <option value="" disabled>
                  {t('vibetubeAdShipper.selectProject')}
                </option>
              )}
              {defaultProjectId && (
                <option value={defaultProjectId}>
                  {t('vibetubeAdShipper.activeGcpProject', { id: defaultProjectId })}
                </option>
              )}
              {SEED_TARGETS.filter(s => s.id !== defaultProjectId).map(s => (
                <option key={s.id} value={s.id}>
                  {s.id} — {s.label}
                </option>
              ))}
              <option value="custom">{t('vibetubeAdShipper.customProject')}</option>
            </select>
            {projectId === 'custom' && (
              <input
                type="text"
                value={customProject}
                onChange={e => setCustomProject(e.target.value)}
                placeholder={t('vibetubeAdShipper.customProjectPlaceholder')}
                className="w-full mt-2 px-3.5 py-2 bg-card border border-hairline rounded-xl text-xs font-mono text-fg focus:border-vibe-cyan focus:outline-none"
              />
            )}
          </div>

          {/* Ad Copy (Max 280 chars) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-fg">
                {t('vibetubeAdShipper.messageLabel')}
              </label>
              <span className={`text-xs font-mono ${message.length > 280 ? 'text-red-400 font-bold' : 'text-fg-muted'}`}>
                {message.length} / 280
              </span>
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={2}
              maxLength={280}
              className="w-full px-3.5 py-2.5 bg-card border border-hairline rounded-xl text-sm font-sans text-fg focus:border-vibe-cyan focus:outline-none resize-none leading-relaxed"
              placeholder="NightGlow Kicks — Illuminate your run. Own the night."
            />
          </div>

          {/* Vibetube Streaming Platform URL */}
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-fg flex items-center justify-between">
              <span>{t('vibetubeAdShipper.platformUrlLabel')}</span>
              <span className="text-xs text-fg-muted font-normal font-mono">{t('vibetubeAdShipper.platformUrlHint')}</span>
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
                <span>{t('vibetubeAdShipper.successTitle')}</span>
              </div>
              <span className="text-xs font-mono px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                {t('vibetubeAdShipper.durationVerified', { seconds: verifiedAd?.durationSeconds || 10 })}
              </span>
            </div>
            
            <p className="text-sm text-fg-muted leading-relaxed font-sans">
              <Trans
                i18nKey="vibetubeAdShipper.successBody"
                values={{ adId: adResult.id, project: activeProjectId, event: activeEventCode }}
                components={{ code: <code className="font-mono text-fg font-bold" /> }}
              />
            </p>

            <div className="flex items-center gap-3 pt-1">
              <a
                href={showroomUrl}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 bg-emerald-400 hover:bg-emerald-300 text-black font-semibold text-sm rounded-xl transition-all flex items-center gap-2 shadow-md cursor-pointer"
              >
                <span>{t('vibetubeAdShipper.openShowroom')}</span>
                <ExternalLink size={14} />
              </a>
              <button
                onClick={() => setStatus('idle')}
                className="px-3 py-2 bg-overlay hover:bg-hairline text-fg text-sm rounded-xl border border-hairline font-semibold transition-all cursor-pointer"
              >
                {t('vibetubeAdShipper.resubmit')}
              </button>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {status === 'error' && (
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl space-y-2 text-xs animate-rise">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm">
              <AlertCircle size={16} />
              <span>{t('vibetubeAdShipper.deploymentNotice')}</span>
            </div>
            <p className="text-fg-muted leading-relaxed">{errorMessage}</p>
            <p className="text-xs text-fg-muted/80 font-sans">
              <Trans i18nKey="vibetubeAdShipper.tip" components={{ code: <code className="font-mono bg-overlay px-1 py-0.5 rounded" /> }} />
            </p>
          </div>
        )}

        {/* Command Line curl Preview per README spec */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-fg-muted font-mono">
            <span className="flex items-center gap-1.5">
              <Terminal size={14} /> {t('vibetubeAdShipper.apiWireCall')} (<code className="text-cyan-700 dark:text-vibe-cyan">POST /api/events/{eventCode}/ads</code>)
            </span>
            <button
              type="button"
              onClick={copyCurl}
              className="flex items-center gap-1 text-xs hover:text-fg transition-all text-fg-muted cursor-pointer font-semibold"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span>{copied ? t('vibetubeAdShipper.copied') : t('vibetubeAdShipper.copyCurl')}</span>
            </button>
          </div>
          <pre className="p-3 bg-black/60 rounded-xl border border-hairline/60 text-xs font-mono text-fg-muted overflow-x-auto leading-relaxed">
            {curlCommand}
          </pre>
        </div>

        {/* Modal Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-hairline">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-fg-muted hover:text-fg bg-overlay hover:bg-hairline border border-hairline transition-all cursor-pointer"
          >
            {t('vibetubeAdShipper.close')}
          </button>
          <button
            type="button"
            onClick={handleShipAd}
            disabled={status === 'shipping' || !isMessageValid || !isTargetValid}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-lg ${
              status === 'shipping' || !isMessageValid || !isTargetValid
                ? 'bg-overlay text-fg-muted/40 border border-hairline cursor-not-allowed'
                : 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black shadow-vibe-cyan/20 cursor-pointer'
            }`}
          >
            {status === 'shipping' ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>{t('vibetubeAdShipper.publishing')}</span>
              </>
            ) : (
              <>
                <span>{t('vibetubeAdShipper.shipAd')}</span>
                <Sparkles size={14} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
