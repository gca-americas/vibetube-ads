import TelemetryQueries from './TelemetryQueries';
import BigQueryAgentPrompts from './BigQueryAgentPrompts';
import HeuristicPolicyEditor from './HeuristicPolicyEditor';
import Simulator from './Simulator';

interface ManualPolicyProps {
  navigate: (v: string) => void;
  activeLab?: string;
}

export default function ManualPolicy({ navigate, activeLab }: ManualPolicyProps) {
  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* 1. BigQuery Telemetry Architecture Diagram */}
      <div className="rounded-3xl overflow-hidden border border-hairline bg-[#FDFBF7] dark:bg-slate-950/40 p-6 md:p-8 shadow-xl flex flex-col items-center justify-center">
        <img
          src="/bigquery-2-tier.png"
          alt="The BigQuery Telemetry Investigation"
          className="w-full max-w-4xl max-h-[460px] object-contain mx-auto rounded-xl drop-shadow-md"
        />
        <p className="text-sm text-slate-600 dark:text-fg-muted font-sans mt-3 text-center max-w-2xl leading-relaxed">
          <strong>The BigQuery Telemetry Investigation:</strong> Progress from raw auction event logs to aggregated diurnal daypart quantiles (P90 clearing prices) to discover market clearing floors.
        </p>
      </div>

      {/* 2. Telemetry SQL Queries Component */}
      <TelemetryQueries />

      {/* 3. BigQuery Agent Prompts Component */}
      <BigQueryAgentPrompts />

      {/* 4. Heuristic Policy Editor (Code Editor + Syntax Validation + Available Context Fields) */}
      <HeuristicPolicyEditor activeLab={activeLab} />

      {/* 5. Embedded Simulation Runner */}
      <div>
        <Simulator 
          navigate={navigate} 
          activeLab={activeLab} 
          attempt={2} 
          embedded={true}
        />
      </div>
    </div>
  );
}
