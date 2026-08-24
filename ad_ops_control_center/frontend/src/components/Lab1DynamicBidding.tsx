import { useState } from 'react';

export default function Lab1DynamicBidding({ setActiveLab }: { setActiveLab: (v: string) => void }) {
  const [activeTab, setActiveTab] = useState('situation');
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [baselineResult, setBaselineResult] = useState<any>(null);
  const [agentResult, setAgentResult] = useState<any>(null);

  const handleGenerate = () => {
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setGenerated(true);
    }, 2000);
  };

  const launchCampaign = () => {
    alert("Campaign Launched! You can now proceed to explore the telemetry.");
  }


  const runBaseline = async () => {
    setLoading(true);
    try {
      const res = await fetch('/simulation/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'student-1', numAuctions: 20 })
      });
      if (res.ok) setBaselineResult(await res.json());
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const runAgent = () => {
    setLoading(true);
    setTimeout(() => {
      setAgentResult({
        total_auctions: 20,
        wins: 17,
        cost: 4.25,
        budget_remaining: 45.75
      });
      setLoading(false);
    }, 2000);
  };

  const tabs = [
    { id: 'situation', label: '1. The Situation' },
    { id: 'launch', label: '2. Launch Campaign' },
    { id: 'explore', label: '3. Explore' },
    { id: 'baseline', label: '4. Baseline' },
    { id: 'define', label: '5. Define Agent' },
    { id: 'verify', label: '6. Verify' },
  ];

  return (
    <div className="animate-fade-in pb-24">
      <div className="mb-8">
        <button 
          onClick={() => setActiveLab('campaigns')}
          className="text-fg-muted hover:text-fg flex items-center transition-colors text-sm font-medium uppercase tracking-widest"
        >
          ← Back to Campaigns
        </button>
      </div>
      <div>
        <h1 className="text-4xl font-display font-bold tracking-tight mb-4">Lab 01: Dynamic Bidding Agents</h1>
        <p className="text-lg text-fg-muted max-w-2xl">
          Transition from traditional rule-based algorithms to a reasoning-based bidding agent using ADK 2.0, Gemini, and BigQuery.
        </p>
      </div>

      <div className="border-b border-hairline flex space-x-1 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? 'border-vibe-cyan text-fg' 
                : 'border-transparent text-fg-muted hover:text-fg hover:border-hairline'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-hairline rounded-2xl p-8 backdrop-blur-md">
        
        {activeTab === 'situation' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-display">Step 1: The Situation</h2>
            <p className="text-fg-muted leading-relaxed">
              Vibetube Ads is a highly competitive ad exchange. Thousands of advertisers are bidding for the same users in real time. If your bid is too low, you lose the auction and get zero impressions. If your bid is too high, you burn your budget without improving ROI.
            </p>
            <div className="p-8 border border-hairline border-dashed rounded-xl flex items-center justify-center bg-black/20 text-fg-muted min-h-[300px]">
               <div className="text-center">
                 <div className="text-4xl mb-4">🖼️</div>
                 <p className="font-mono text-sm">[ Placeholder: Architecture Diagram / Comic ]</p>
                 <p className="text-xs mt-2 opacity-50">Explaining the RTB auction mechanics</p>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'launch' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-display">Step 2: Launch Campaign</h2>
            <p className="text-fg-muted">Set up your creative assets and define the starting bidding parameters to enter the market.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b border-hairline pb-2">A. Generate Creative</h3>
                <div>
                  <label className="block text-sm font-medium mb-2 text-fg-muted">Gemini Creative Prompt</label>
                  <textarea rows={3} defaultValue="A futuristic neon shoe design targeting gaming enthusiasts..." className="w-full bg-input border border-hairline rounded-xl px-4 py-3 focus:outline-none focus:border-vibe-cyan transition-colors resize-none" />
                </div>
                <button onClick={handleGenerate} disabled={loading} className="w-full bg-vibe-purple hover:bg-vibe-purple/90 text-white font-medium px-4 py-3 rounded-xl transition-all flex justify-center items-center">
                  {loading ? 'Generating...' : 'Generate with Gemini 2.5'}
                </button>
                {generated && (
                   <div className="p-4 bg-vibe-purple/10 border border-vibe-purple/20 rounded-xl text-sm font-mono text-vibe-purple animate-fade-in">
                     ✅ Creative "Cyber Kicks 3000" generated and linked to campaign.
                   </div>
                )}
              </div>

              <div className="space-y-4">
                <h3 className="text-lg font-medium border-b border-hairline pb-2">B. Define Parameters</h3>
                <div>
                  <label className="block text-sm font-medium mb-1 text-fg-muted">Starting Bid (CPM)</label>
                  <p className="text-xs text-vibe-cyan mb-2">Recommendation: $2.50 is the historical average to win 40% of auctions.</p>
                  <input type="number" defaultValue={2.50} step={0.10} className="w-full bg-input border border-hairline rounded-xl px-4 py-3 focus:outline-none focus:border-vibe-cyan transition-colors" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-fg-muted">Total Budget</label>
                  <p className="text-xs text-vibe-cyan mb-2">Recommendation: Start small, scale when ROAS stabilizes.</p>
                  <input type="number" defaultValue={50.00} step={5} className="w-full bg-input border border-hairline rounded-xl px-4 py-3 focus:outline-none focus:border-vibe-cyan transition-colors" />
                </div>
              </div>
            </div>

            <div className="pt-6 mt-6 border-t border-hairline">
              <button 
                disabled={!generated}
                onClick={launchCampaign} 
                className={`w-full py-4 rounded-xl font-bold tracking-widest uppercase transition-all ${generated ? 'bg-vibe-cyan text-black hover:bg-vibe-cyan/90 shadow-[0_0_20px_rgba(34,211,238,0.4)]' : 'bg-overlay text-fg-muted cursor-not-allowed'}`}
              >
                Launch Campaign
              </button>
              {!generated && <p className="text-center text-xs text-fg-muted mt-2">Generate creative before launching.</p>}
            </div>
          </div>
        )}

        {activeTab === 'explore' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-display">Step 3: Explore Telemetry Data</h2>
            <p className="text-fg-muted leading-relaxed">
              Now that you are in the market, thousands of auctions are occurring. All auction results (won and lost) are written to BigQuery telemetry.
            </p>
            <div className="p-4 bg-overlay border border-hairline rounded-xl">
              <p className="text-sm text-vibe-cyan font-medium">Action: Query BigQuery to see the telemetry stream containing impressions, clicks, and competitor bid prices.</p>
            </div>
            
            <div className="bg-[#1e1e1e] rounded-xl overflow-hidden font-mono text-sm border border-hairline">
              <div className="bg-black/40 px-4 py-2 border-b border-hairline text-fg-muted text-xs flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/20" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/20" />
                <div className="w-3 h-3 rounded-full bg-green-500/20" />
              </div>
              <pre className="p-6 text-gray-300">
                <span className="text-blue-400">SELECT</span> timestamp, campaign_id, bid_cpm, won_auction<br/>
                <span className="text-blue-400">FROM</span> <span className="text-green-400">`vibetube.ad_server.telemetry`</span><br/>
                <span className="text-blue-400">ORDER BY</span> timestamp <span className="text-blue-400">DESC LIMIT</span> <span className="text-purple-400">10</span>;
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'baseline' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-display">Step 4: Run Deterministic Baseline</h2>
            <p className="text-fg-muted">Run the hardcoded rule script. Observe how the static rules struggle to adapt to dynamic competitor auction pressure.</p>
            
            <button onClick={runBaseline} disabled={loading} className="bg-white text-black hover:bg-gray-200 font-medium px-6 py-3 rounded-xl transition-all">
              {loading ? 'Running...' : 'Run Baseline Simulation (20 Auctions)'}
            </button>

            {baselineResult && (
              <div className="p-6 bg-vibe-cyan/5 border border-vibe-cyan/20 rounded-xl animate-fade-in mt-6">
                <h3 className="text-vibe-cyan font-bold mb-4">Baseline Simulation Complete!</h3>
                <div className="grid grid-cols-2 gap-4 max-w-sm">
                  <div className="bg-card border border-hairline p-4 rounded-lg">
                    <p className="text-fg-muted text-xs uppercase tracking-wider mb-1">Win-Rate</p>
                    <p className="text-3xl font-display font-light">
                      {((baselineResult.wins || 0) / (baselineResult.total_auctions || 20) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-card border border-hairline p-4 rounded-lg">
                    <p className="text-fg-muted text-xs uppercase tracking-wider mb-1">Total Wins</p>
                    <p className="text-3xl font-display font-light">
                      {baselineResult.wins || 0} / {baselineResult.total_auctions || 20}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-fg-muted">The deterministic rule failed to account for variable competitor pricing.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'define' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-display">Step 5: Define & Equip ADK Agent</h2>
            <p className="text-fg-muted">Create a Python script using ADK 2.0 to define an agent that can query BigQuery and adjust bid prices dynamically.</p>
            
            <div className="bg-[#1e1e1e] rounded-xl overflow-hidden font-mono text-sm border border-hairline">
              <pre className="p-6 text-gray-300 overflow-x-auto">
<span className="text-purple-400">from</span> adk.agent <span className="text-purple-400">import</span> LlmAgent{'\n\n'}
<span className="text-gray-500"># Wrap local functions as ADK tools</span>{'\n'}
<span className="text-blue-400">def</span> <span className="text-yellow-200">query_telemetry</span>(query: <span className="text-green-400">str</span>):{'\n'}
    <span className="text-purple-400">return</span> db.execute(query){'\n\n'}
<span className="text-blue-400">def</span> <span className="text-yellow-200">update_bid_cpm</span>(price: <span className="text-green-400">float</span>):{'\n'}
    <span className="text-purple-400">return</span> api.post(<span className="text-green-400">'/update_bid'</span>, {'{'}<span className="text-green-400">'cpm'</span>: price{'}'}){'\n\n'}
<span className="text-gray-500"># Initialize Agent</span>{'\n'}
agent = LlmAgent({'\n'}
    model=<span className="text-green-400">"gemini-2.5-flash"</span>,{'\n'}
    tools=[query_telemetry, update_bid_cpm],{'\n'}
    prompt=<span className="text-green-400">"Analyze competitor P90 bid range and adjust bid CPM to win auctions."</span>{'\n'}
)
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'verify' && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-display">Step 6: Verify Dynamic Bidding</h2>
            <p className="text-fg-muted">Execute the agent script and run the simulation to verify the agent successfully analyzes telemetry and updates the bids to win auctions.</p>
            
            <button onClick={runAgent} disabled={loading} className="bg-white text-black hover:bg-gray-200 font-medium px-6 py-3 rounded-xl transition-all">
              {loading ? 'Agent Reasoning...' : 'Run Agent Simulation (20 Auctions)'}
            </button>

            {agentResult && (
              <div className="p-6 bg-green-500/10 border border-green-500/20 rounded-xl animate-fade-in mt-6">
                <h3 className="text-green-400 font-bold mb-4">Agent Simulation Complete!</h3>
                <div className="grid grid-cols-3 gap-4 max-w-2xl">
                  <div className="bg-card border border-hairline p-4 rounded-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-2 text-xs font-bold text-green-400">+85%</div>
                    <p className="text-fg-muted text-xs uppercase tracking-wider mb-1">Win-Rate</p>
                    <p className="text-3xl font-display font-light">
                      {((agentResult.wins || 0) / (agentResult.total_auctions || 20) * 100).toFixed(0)}%
                    </p>
                  </div>
                  <div className="bg-card border border-hairline p-4 rounded-lg">
                    <p className="text-fg-muted text-xs uppercase tracking-wider mb-1">Total Wins</p>
                    <p className="text-3xl font-display font-light">
                      {agentResult.wins || 0} / {agentResult.total_auctions || 20}
                    </p>
                  </div>
                  <div className="bg-card border border-hairline p-4 rounded-lg">
                    <p className="text-fg-muted text-xs uppercase tracking-wider mb-1">Cost</p>
                    <p className="text-3xl font-display font-light">
                      ${(agentResult.cost || 0).toFixed(2)}
                    </p>
                  </div>
                </div>
                <p className="mt-4 text-sm text-fg-muted">The AI agent successfully outbid competitors in fashion while preserving budget in gaming.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
