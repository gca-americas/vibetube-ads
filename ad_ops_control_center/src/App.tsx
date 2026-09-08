import { useState } from 'react';
import { Ambience } from './components/Ambience';
import TopNav from './components/TopNav';

import Console from './components/Console';
import Campaigns from './components/Campaigns';
import Simulator from './components/Simulator';
import ManualPolicy from './components/ManualPolicy';
import AIDataEngineer from './components/AIDataEngineer';
import AgentExecution from './components/AgentExecution';
import ADKEval from './components/ADKEval';
import JudgeAgent from './components/JudgeAgent';
import WireOptimizationLoop from './components/WireOptimizationLoop';
import OptimizationFlywheel from './components/OptimizationFlywheel';
import Scorecard from './components/Scorecard';

function App() {
  // Navigation states: 'console', 'campaigns', 'simulator1', 'manual_policy', 'simulator2', 'ai_engineer', 'agent_execution', 'adk_eval', 'judge_agent', 'wire_loop', 'flywheel', 'simulator3', 'scorecard'
  const [activeLab, setActiveLab] = useState('console');

  return (
    <div className="min-h-screen bg-stage text-fg font-sans relative overflow-hidden flex flex-col">
      <Ambience />
      
      <div className="relative z-10 flex flex-col h-screen">
        <TopNav activeLab={activeLab} setActiveLab={setActiveLab} />
        
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-24 flex justify-center">
          <div className="w-full max-w-6xl">
            {activeLab === 'console' && <Console navigate={setActiveLab} />}
            
            <div className={activeLab === 'campaigns' ? 'block' : 'hidden'}>
              <Campaigns navigate={setActiveLab} />
            </div>
            
            <div className={(activeLab === 'simulator1' || activeLab === 'simulator') ? 'block' : 'hidden'}>
              <Simulator navigate={setActiveLab} activeLab={activeLab} attempt={1} />
            </div>

            <div className={(activeLab === 'manual_policy' || activeLab === 'policy') ? 'block' : 'hidden'}>
              <ManualPolicy navigate={setActiveLab} activeLab={activeLab} />
            </div>

            <div className={activeLab === 'simulator2' ? 'block' : 'hidden'}>
              <Simulator navigate={setActiveLab} activeLab={activeLab} attempt={2} />
            </div>

            <div className={activeLab === 'ai_engineer' ? 'block' : 'hidden'}>
              <AIDataEngineer navigate={setActiveLab} />
            </div>

            <div className={activeLab === 'agent_execution' ? 'block' : 'hidden'}>
              <AgentExecution navigate={setActiveLab} activeLab={activeLab} />
            </div>

            <div className={activeLab === 'adk_eval' ? 'block' : 'hidden'}>
              <ADKEval navigate={setActiveLab} />
            </div>

            <div className={activeLab === 'judge_agent' ? 'block' : 'hidden'}>
              <JudgeAgent navigate={setActiveLab} />
            </div>

            <div className={(activeLab === 'wire_loop' || activeLab === 'wire_flywheel') ? 'block' : 'hidden'}>
              <WireOptimizationLoop navigate={setActiveLab} />
            </div>

            <div className={(activeLab === 'flywheel' || activeLab === 'optimize_loop') ? 'block' : 'hidden'}>
              <OptimizationFlywheel navigate={setActiveLab} activeLab={activeLab} />
            </div>

            <div className={activeLab === 'simulator3' ? 'block' : 'hidden'}>
              <Simulator navigate={setActiveLab} activeLab={activeLab} attempt={3} />
            </div>

            <div className={activeLab === 'scorecard' ? 'block' : 'hidden'}>
              <Scorecard navigate={setActiveLab} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
