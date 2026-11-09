/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import { 
  Flame, 
  Layers, 
  Activity, 
  Terminal, 
  ShieldCheck, 
  Sparkles, 
  Play, 
  Pause, 
  AlertCircle, 
  FileCode,
  CheckCircle2,
  GitBranch,
  Calculator
} from 'lucide-react';

import { Mission, Task, ActivityLog, Artifact, VerificationReport } from './types/agent';
import { INITIAL_MISSION_HISTORY } from './data/presetMissions';
import { sounds } from './utils/audio';

import { Navbar } from './components/Navbar';
import { SystemNoticeBanner } from './components/SystemNoticeBanner';
import { GoalInputDashboard } from './components/GoalInputDashboard';
import { TaskPlannerView } from './components/TaskPlannerView';
import { ExecutionMonitor } from './components/ExecutionMonitor';
import { ExecutionControls } from './components/ExecutionControls';
import { ActivityLogView } from './components/ActivityLogView';
import { VerificationReportView } from './components/VerificationReportView';
import { ArtifactModal } from './components/ArtifactModal';
import { HistoryDrawer } from './components/HistoryDrawer';
import { HelpModal } from './components/HelpModal';

const STORAGE_KEY = 'phoenix_mission_history_v2';

export default function App() {
  const [missionHistory, setMissionHistory] = useState<Mission[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.warn('Failed to parse history from storage', e);
    }
    return INITIAL_MISSION_HISTORY;
  });

  const [currentMission, setCurrentMission] = useState<Mission | null>(() => {
    return INITIAL_MISSION_HISTORY[0] || null;
  });

  const [activeTab, setActiveTab] = useState<string>('report');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);

  // References to control execution loop state
  const isExecutingRef = useRef(false);
  const isPausedRef = useRef(false);
  const isCancelledRef = useRef(false);
  const missionRef = useRef<Mission | null>(currentMission);

  useEffect(() => {
    missionRef.current = currentMission;
  }, [currentMission]);

  // Sync history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(missionHistory));
    } catch (e) {
      console.warn('Failed to save to localStorage', e);
    }
  }, [missionHistory]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    sounds.enabled = next;
  };

  // Launch a new goal
  const handleStartMission = async ({
    goal,
    persona,
    executionDepth,
    targetDeadline,
  }: {
    goal: string;
    persona: string;
    executionDepth: string;
    targetDeadline: string;
  }) => {
    try {
      setIsPlanning(true);
      sounds.playStepStart();

      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal, persona, executionDepth, targetDeadline }),
      });

      const data = await response.json();
      const plan = data.plan;

      const missionId = `mission-${Date.now().toString(36)}`;
      const tasks: Task[] = (plan.tasks || []).map((t: any) => ({
        ...t,
        status: 'pending',
        toolType: t.toolType || (t.tool === 'calculator' ? 'REAL' : t.simulated ? 'SIMULATED' : 'REAL'),
        simulated: t.tool === 'calculator' ? false : t.simulated,
      }));

      const hasRealTool = tasks.some((t) => t.toolType === 'REAL' || t.tool === 'calculator');

      const initialLogs: ActivityLog[] = [
        {
          id: `log-init-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'INFO',
          title: 'Mission Initialized',
          message: `Deconstructed goal into ${tasks.length} execution stages. Persona: ${persona}. Mode: ${hasRealTool ? 'GENUINE CALLABLE TOOL' : 'Safe Demo Sandbox'}.`,
        },
        {
          id: `log-plan-${Date.now() + 1}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'REASONING',
          title: 'DAG Plan Formulated',
          message: plan.objectiveSummary || 'Autonomous execution graph formulated.',
        },
      ];

      const newMission: Mission = {
        id: missionId,
        title: plan.missionName || `Operation: ${goal.slice(0, 24)}...`,
        goal,
        persona,
        executionDepth,
        targetDeadline,
        status: 'executing',
        progress: 0,
        currentStepId: tasks[0]?.id,
        tasks,
        logs: initialLogs,
        artifacts: [],
        startedAt: new Date().toISOString(),
        executionSpeed: 1,
      };

      setCurrentMission(newMission);
      missionRef.current = newMission;
      setIsPlanning(false);
      setActiveTab('execution');

      // Start real execution loop
      runExecutionPipeline(newMission);
    } catch (err: any) {
      console.error('Failed to plan mission:', err);
      setIsPlanning(false);
    }
  };

  // Real Execution Pipeline (Driven by actual tool events, NOT artificial setTimeout delays!)
  const runExecutionPipeline = async (initialMission: Mission) => {
    isExecutingRef.current = true;
    isPausedRef.current = false;
    isCancelledRef.current = false;

    let activeMission = { ...initialMission };
    const tasks = [...activeMission.tasks];
    const totalTasks = tasks.length;

    for (let i = 0; i < totalTasks; i++) {
      if (isCancelledRef.current) break;

      const task = tasks[i];

      // Handle pause before task start
      while (isPausedRef.current && !isCancelledRef.current) {
        await new Promise((r) => setTimeout(r, 200));
      }
      if (isCancelledRef.current) break;

      // Mark current task as running
      task.status = 'running';
      activeMission.currentStepId = task.id;
      activeMission.status = 'executing';
      // Progress reflects real step milestone
      activeMission.progress = (i / totalTasks) * 100;
      sounds.playStepStart();

      const startLog: ActivityLog = {
        id: `log-step-start-${Date.now()}-${i}`,
        timestamp: new Date().toLocaleTimeString(),
        level: 'EXEC',
        title: `Executing Step 0${i + 1} [${task.toolType || (task.simulated ? 'SIMULATED' : 'REAL')}]`,
        message: `${task.title} (Tool: ${task.tool})`,
        stepId: task.id,
        simulated: task.simulated,
        toolType: task.toolType,
      };

      activeMission.logs = [...activeMission.logs, startLog];
      activeMission.tasks = [...tasks];
      setCurrentMission({ ...activeMission });
      missionRef.current = activeMission;

      // Actually execute the tool on the backend!
      try {
        const stepRes = await fetch('/api/execute-step', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: activeMission.goal,
            task,
            completedTasks: tasks.slice(0, i).map((t) => t.title),
            persona: activeMission.persona,
          }),
        });

        const stepData = await stepRes.json();

        // Check if tool execution or verification failed
        if (stepData.status === 'FAILED' || !stepData.verificationPassed) {
          task.status = 'failed';
          task.error = stepData.error || 'Tool execution or verification failed';
          task.verificationPassed = false;
          task.logs = stepData.logs || [];

          activeMission.status = 'failed';
          activeMission.logs.push({
            id: `log-err-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'ERROR',
            title: `Step 0${i + 1} Failed Verification`,
            message: task.error || 'Execution halted. Tool returned failure.',
            stepId: task.id,
          });

          sounds.playPause();
          setCurrentMission({ ...activeMission });
          isExecutingRef.current = false;
          return; // STOP EXECUTION! Do not fabricate success!
        }

        // Tool succeeded and passed verification!
        task.status = 'completed';
        task.reasoning = stepData.reasoning;
        task.executionBadge = stepData.executionBadge;
        task.toolInput = stepData.toolInput;
        task.toolOutput = stepData.toolOutput;
        task.verificationPassed = true;

        // Add verified artifact
        if (stepData.artifactPayload) {
          const newArtifact: Artifact = {
            id: `art-${Date.now()}-${i}`,
            name: stepData.artifactPayload.name || task.expectedArtifact || `artifact_${i}.json`,
            format: stepData.artifactPayload.format || 'json',
            content: stepData.artifactPayload.content || '',
            stepId: task.id,
            timestamp: new Date().toLocaleTimeString(),
            isRealExecution: !task.simulated,
          };
          task.outputArtifact = newArtifact;
          activeMission.artifacts = [...activeMission.artifacts, newArtifact];
        }

        // Add real telemetry logs
        const newLogs: ActivityLog[] = (stepData.logs || []).map((l: string, idx: number) => ({
          id: `log-res-${Date.now()}-${idx}`,
          timestamp: new Date().toLocaleTimeString(),
          level: idx === 0 ? 'REASONING' : 'INFO',
          title: `Step 0${i + 1} Telemetry`,
          message: l,
          stepId: task.id,
          simulated: task.simulated,
          toolType: task.toolType,
        }));

        activeMission.logs = [
          ...activeMission.logs,
          ...newLogs,
          {
            id: `log-done-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'SUCCESS',
            title: `Step 0${i + 1} Verified Complete`,
            message: `Tool ${task.tool} returned verified output: ${stepData.verificationEvidence || 'OK'}`,
            stepId: task.id,
            toolType: task.toolType,
          },
        ];

        sounds.playStepComplete();
      } catch (stepErr: any) {
        console.error('Fatal error executing step:', stepErr);
        task.status = 'failed';
        task.error = stepErr.message || 'Network / server exception';
        activeMission.status = 'failed';
        activeMission.logs.push({
          id: `log-fail-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString(),
          level: 'ERROR',
          title: `Step 0${i + 1} System Exception`,
          message: task.error || 'Execution aborted due to unexpected exception.',
          stepId: task.id,
        });

        sounds.playPause();
        setCurrentMission({ ...activeMission });
        isExecutingRef.current = false;
        return; // HALT EXECUTION
      }

      // Update real milestone progress
      activeMission.tasks = [...tasks];
      activeMission.progress = ((i + 1) / totalTasks) * 100;
      setCurrentMission({ ...activeMission });
      missionRef.current = activeMission;
    }

    // Finished or Cancelled
    if (isCancelledRef.current) {
      activeMission.status = 'cancelled';
      activeMission.logs.push({
        id: `log-cancel-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        level: 'WARN',
        title: 'Mission Aborted',
        message: 'Operator invoked safe cancellation. Active routines terminated.',
      });
      setCurrentMission({ ...activeMission });
      isExecutingRef.current = false;
      return;
    }

    // All tasks succeeded and verified!
    activeMission.status = 'completed';
    activeMission.progress = 100;
    activeMission.endedAt = new Date().toISOString();

    try {
      const verifyRes = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: activeMission.goal,
          missionName: activeMission.title,
          tasks: activeMission.tasks,
          artifacts: activeMission.artifacts,
          durationSec: 4,
        }),
      });

      const verifyData = await verifyRes.json();
      activeMission.report = verifyData.report;

      activeMission.logs.push({
        id: `log-verify-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString(),
        level: 'SUCCESS',
        title: 'Deterministic Verification Certificate Issued',
        message: `Score: ${verifyData.report.satisfactionScore}/100 [${verifyData.report.verificationStatus}]. Real Tools: ${verifyData.report.metrics.realToolsExecuted}.`,
      });

      sounds.playSuccessFanfare();
      confetti({
        particleCount: 70,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#A855F7', '#06B6D4', '#38BDF8', '#10B981'],
      });
    } catch (vErr) {
      console.error('Error generating verification report:', vErr);
    }

    setCurrentMission({ ...activeMission });
    setMissionHistory((prev) => [activeMission, ...prev.filter((m) => m.id !== activeMission.id)]);
    isExecutingRef.current = false;
    setActiveTab('report');
  };

  // Execution Control Handlers
  const handlePause = () => {
    isPausedRef.current = true;
    sounds.playPause();
    if (currentMission) {
      const updated = {
        ...currentMission,
        status: 'paused' as const,
        logs: [
          ...currentMission.logs,
          {
            id: `log-pause-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'WARN' as const,
            title: 'Operator Pause',
            message: 'Execution loop frozen by operator. State preserved.',
          },
        ],
      };
      setCurrentMission(updated);
    }
  };

  const handleResume = () => {
    isPausedRef.current = false;
    sounds.playStepStart();
    if (currentMission) {
      const updated = {
        ...currentMission,
        status: 'executing' as const,
        logs: [
          ...currentMission.logs,
          {
            id: `log-resume-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            level: 'INFO' as const,
            title: 'Execution Resumed',
            message: 'Continuing autonomous pipeline from active checkpoint.',
          },
        ],
      };
      setCurrentMission(updated);
    }
  };

  const handleCancel = () => {
    isCancelledRef.current = true;
    isPausedRef.current = false;
    sounds.playPause();
  };

  const handleStepNext = () => {
    if (isPausedRef.current) {
      isPausedRef.current = false;
      setTimeout(() => {
        isPausedRef.current = true;
      }, 500);
    }
  };

  const handleSetSpeed = (speed: number) => {
    if (currentMission) {
      setCurrentMission({
        ...currentMission,
        executionSpeed: speed,
      });
    }
  };

  const handleRestartMission = () => {
    if (!currentMission) return;
    handleStartMission({
      goal: currentMission.goal,
      persona: currentMission.persona,
      executionDepth: currentMission.executionDepth,
      targetDeadline: currentMission.targetDeadline,
    });
  };

  const handleForkGoal = () => {
    setActiveTab('dashboard');
  };

  const handleClearHistory = () => {
    setMissionHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  return (
    <div className="min-h-screen bg-[#08090E] text-slate-100 cyber-grid flex flex-col font-sans selection:bg-purple-600 selection:text-white">
      {/* Top Navbar */}
      <Navbar
        currentMission={currentMission}
        historyCount={missionHistory.length}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
        onOpenHistory={() => setIsHistoryOpen(true)}
        onOpenHelp={() => setIsHelpOpen(true)}
        onNewMission={() => setActiveTab('dashboard')}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      {/* Safety & Tool Status Banner */}
      <SystemNoticeBanner />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Floating Execution Controls */}
        {currentMission && currentMission.status !== 'idle' && activeTab !== 'dashboard' && (
          <ExecutionControls
            mission={currentMission}
            onPause={handlePause}
            onResume={handleResume}
            onCancel={handleCancel}
            onStepNext={handleStepNext}
            onSetSpeed={handleSetSpeed}
            onRestart={handleRestartMission}
          />
        )}

        {/* Tab 1: Goal Input Dashboard */}
        {activeTab === 'dashboard' && (
          <GoalInputDashboard
            onStartMission={handleStartMission}
            isPlanning={isPlanning}
          />
        )}

        {/* Tab 2: Task Planner */}
        {activeTab === 'planner' && currentMission && (
          <TaskPlannerView
            mission={currentMission}
            onSelectArtifact={(art) => setSelectedArtifact(art)}
          />
        )}

        {/* Tab 3: Execution Monitor */}
        {activeTab === 'execution' && currentMission && (
          <ExecutionMonitor
            mission={currentMission}
            onSelectArtifact={(art) => setSelectedArtifact(art)}
            onViewReport={() => setActiveTab('report')}
          />
        )}

        {/* Tab 4: Activity Logs */}
        {activeTab === 'logs' && currentMission && (
          <ActivityLogView
            logs={currentMission.logs}
            onClearLogs={() => {
              if (currentMission) {
                setCurrentMission({ ...currentMission, logs: [] });
              }
            }}
          />
        )}

        {/* Tab 5: Verification Report */}
        {activeTab === 'report' && currentMission && (
          currentMission.report ? (
            <VerificationReportView
              report={currentMission.report}
              mission={currentMission}
              onSelectArtifact={(art) => setSelectedArtifact(art)}
              onRerun={handleRestartMission}
              onForkGoal={handleForkGoal}
            />
          ) : (
            <div className="glass-panel p-10 rounded-2xl text-center space-y-4 max-w-lg mx-auto">
              <div className="p-3 rounded-full bg-purple-950/60 border border-purple-800 text-purple-300 w-12 h-12 mx-auto flex items-center justify-center">
                <Activity className="w-6 h-6 animate-pulse" />
              </div>
              <h3 className="font-display font-bold text-lg text-white">
                Mission Execution in Progress
              </h3>
              <p className="text-xs text-slate-400 font-sans">
                The verification report will be generated after authentic tool executions conclude.
              </p>
              <button
                onClick={() => setActiveTab('execution')}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs transition-colors"
              >
                View Live Telemetry ({Math.round(currentMission.progress)}%)
              </button>
            </div>
          )
        )}
      </main>

      {/* Artifact Inspector Modal */}
      <ArtifactModal
        artifact={selectedArtifact}
        onClose={() => setSelectedArtifact(null)}
      />

      {/* Mission History Drawer */}
      <HistoryDrawer
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        missions={missionHistory}
        onSelectMission={(m) => {
          setCurrentMission(m);
          setActiveTab('report');
        }}
        onClearHistory={handleClearHistory}
      />

      {/* Beginner Help Modal */}
      <HelpModal
        isOpen={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-[#06070B] py-4 text-center text-xs font-mono text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PHOENIX NEURAL AGENT SYSTEM // v3.8</span>
          <span className="text-[11px] text-slate-600">
            Real Tool Execution Engine • Modular Registry Active
          </span>
        </div>
      </footer>
    </div>
  );
}
