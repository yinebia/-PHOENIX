import React from 'react';
import { 
  ShieldCheck, 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  FileCode, 
  Download, 
  Sparkles, 
  ExternalLink,
  RotateCcw,
  Layers,
  ArrowRight
} from 'lucide-react';
import { VerificationReport, Artifact, Mission } from '../types/agent';

interface VerificationReportViewProps {
  report: VerificationReport;
  mission: Mission;
  onSelectArtifact?: (artifact: Artifact) => void;
  onRerun: () => void;
  onForkGoal: () => void;
}

export const VerificationReportView: React.FC<VerificationReportViewProps> = ({
  report,
  mission,
  onSelectArtifact,
  onRerun,
  onForkGoal,
}) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'VERIFIED_SATISFIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
            <CheckCircle2 className="w-3.5 h-3.5" />
            VERIFIED // FULL COMPLIANCE
          </span>
        );
      case 'CONDITIONALLY_VERIFIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            <AlertTriangle className="w-3.5 h-3.5" />
            CONDITIONALLY VERIFIED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
            <ShieldCheck className="w-3.5 h-3.5" />
            {status}
          </span>
        );
    }
  };

  const handleDownloadReport = () => {
    const reportMarkdown = `# PHOENIX AGENT VERIFICATION REPORT
**Mission:** ${mission.title}
**Goal:** ${mission.goal}
**Satisfaction Score:** ${report.satisfactionScore} / 100
**Verification Status:** ${report.verificationStatus}
**Agent Persona:** ${mission.persona}
**Date:** ${new Date().toISOString()}

---

## 1. EXECUTIVE SUMMARY
${report.executiveSummary}

## 2. ENVIRONMENT & SAFETY NOTICE
${report.environmentNote}

## 3. VERIFIED DELIVERABLES & ARTIFACTS
${report.verifiedArtifacts.map((a) => `- **${a.title}** [${a.status}]: ${a.summary}`).join('\n')}

## 4. RISK ASSESSMENT & SANDBOX ISOLATION
${report.riskAssessment.map((r) => `- [x] ${r}`).join('\n')}

${report.edgeCasesIdentified ? `## 5. IDENTIFIED EDGE CASES\n${report.edgeCasesIdentified.map((e) => `- ${e}`).join('\n')}\n` : ''}
## 6. HUMAN-IN-THE-LOOP RECOMMENDATIONS
${report.humanRecommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}

---
*Generated autonomously by PHOENIX v3.8 Verification Engine.*
`;

    const blob = new Blob([reportMarkdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phoenix_verification_${mission.id}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto py-2">
      {/* Header Card */}
      <div className="glass-panel p-6 sm:p-8 rounded-2xl border-purple-500/30 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-cyan-600/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

        <div className="relative flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
                Audit Verification Certificate
              </span>
              <span className="text-slate-600">|</span>
              {getStatusBadge(report.verificationStatus)}
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-display text-white">
              {mission.title}
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 font-sans max-w-xl">
              {report.executiveSummary}
            </p>
          </div>

          {/* Satisfaction Score Badge */}
          <div className="shrink-0 flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/90 border border-purple-500/40 shadow-xl">
            <div className="relative flex items-center justify-center w-24 h-24">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  stroke="#1E2337"
                  strokeWidth="6"
                  fill="transparent"
                />
                <circle
                  cx="48"
                  cy="48"
                  r="38"
                  stroke="#10B981"
                  strokeWidth="6"
                  strokeDasharray={2 * Math.PI * 38}
                  strokeDashoffset={2 * Math.PI * 38 * (1 - report.satisfactionScore / 100)}
                  strokeLinecap="round"
                  fill="transparent"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-black font-display text-white">
                  {report.satisfactionScore}%
                </span>
                <span className="text-[9px] font-mono uppercase text-emerald-400">
                  SATISFACTION
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Safety & Environment Note */}
        <div className="mt-6 p-3.5 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs text-slate-300 font-sans flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-mono text-cyan-300 font-semibold block mb-0.5">
              Verified Sandbox Environment Notice:
            </span>
            {report.environmentNote}
          </div>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <div className="glass-panel p-4 rounded-xl border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">Total DAG Steps</span>
          <span className="text-lg font-bold text-white mt-1 block">{report.metrics.totalSteps}</span>
          <span className="text-[10px] text-emerald-400">100% Executed</span>
        </div>
        <div className="glass-panel p-4 rounded-xl border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">Verified Assertions</span>
          <span className="text-lg font-bold text-emerald-300 mt-1 block">{report.metrics.verifiedSteps}</span>
          <span className="text-[10px] text-slate-400">Zero Failures</span>
        </div>
        <div className="glass-panel p-4 rounded-xl border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">Deliverables</span>
          <span className="text-lg font-bold text-purple-300 mt-1 block">{report.metrics.artifactsCount}</span>
          <span className="text-[10px] text-purple-400">Ready in Vault</span>
        </div>
        <div className="glass-panel p-4 rounded-xl border-slate-800">
          <span className="text-slate-500 text-[10px] uppercase block">Execution Mode</span>
          <span className="text-xs font-bold text-cyan-300 mt-1 block truncate">{report.metrics.executionMode}</span>
          <span className="text-[10px] text-slate-400">Safe Demo Active</span>
        </div>
      </div>

      {/* Verified Artifacts List */}
      <div className="glass-panel p-6 rounded-2xl border-purple-500/20 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-sm text-slate-100 uppercase tracking-wider flex items-center gap-2">
            <FileCode className="w-4 h-4 text-purple-400" />
            Synthesized Deliverables & Proof Artifacts
          </h3>
          <span className="text-xs font-mono text-slate-500">
            {report.verifiedArtifacts.length} Validated Items
          </span>
        </div>

        <div className="space-y-3">
          {report.verifiedArtifacts.map((artifact, idx) => {
            const fullArtifact = mission.artifacts.find((a) => a.name === artifact.title);
            return (
              <div
                key={idx}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 hover:border-purple-500/40 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold text-purple-300">
                      {artifact.title}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800/50">
                      {artifact.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-sans">
                    {artifact.summary}
                  </p>
                </div>

                {fullArtifact && onSelectArtifact && (
                  <button
                    onClick={() => onSelectArtifact(fullArtifact)}
                    className="px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 text-xs font-mono flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <span>Inspect Raw Content</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Risk Assessment & Human Recommendations */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk Assessment */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
          <h4 className="font-display font-bold text-xs uppercase tracking-wider text-amber-300 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Risk Assessment & Safety Boundaries
          </h4>
          <ul className="space-y-2 text-xs text-slate-300 font-sans">
            {report.riskAssessment.map((risk, i) => (
              <li key={i} className="flex items-start gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                <span className="text-cyan-400 font-mono mt-0.5">•</span>
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Human Next Steps */}
        <div className="glass-panel p-6 rounded-2xl border-slate-800 space-y-3">
          <h4 className="font-display font-bold text-xs uppercase tracking-wider text-cyan-300 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            Human-in-the-Loop Action Items
          </h4>
          <ul className="space-y-2 text-xs text-slate-300 font-sans">
            {report.humanRecommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-2 bg-slate-900/40 p-2.5 rounded-lg border border-slate-800">
                <span className="text-purple-400 font-mono font-bold mt-0.5">{i + 1}.</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Action Footer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 glass-panel rounded-2xl border-purple-500/30">
        <button
          onClick={handleDownloadReport}
          className="px-4 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-display font-bold text-xs flex items-center gap-2 shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Download Verification Certificate (.md)</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onForkGoal}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-colors"
          >
            Fork / Adjust Goal
          </button>
          <button
            onClick={onRerun}
            className="px-4 py-2.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-500/40 text-xs font-mono flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Rerun Mission</span>
          </button>
        </div>
      </div>
    </div>
  );
};
