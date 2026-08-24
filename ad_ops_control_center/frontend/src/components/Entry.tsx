export default function Entry({ onEnter }: { onEnter: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center max-w-2xl mx-auto space-y-8 animate-rise">
      <h1 className="text-6xl font-display font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-fg to-fg/60">
        Vibetube Ads Platform
      </h1>
      <p className="text-2xl text-fg-muted leading-relaxed">
        Welcome to the Ad Ops Control Center. Here you can configure ad campaigns, deploy autonomous bidding agents, and analyze your return on ad spend.
      </p>
      
      <button 
        onClick={onEnter}
        className="mt-8 px-12 py-4 bg-vibe-blue hover:bg-vibe-blue/90 text-white rounded-2xl font-bold text-xl transition-all hover:scale-105 shadow-[0_0_40px_rgba(59,130,246,0.3)]"
      >
        Enter
      </button>
    </div>
  );
}
