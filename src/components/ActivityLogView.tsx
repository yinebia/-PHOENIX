import React, { useState, useRef, useEffect } from 'react';
import { 
  Terminal, 
  Search, 
  Download, 
  Filter, 
  CheckCircle2, 
  AlertTriangle, 
  Cpu, 
  Layers, 
  FileCode,
  ArrowDown,
  Trash2
} from 'lucide-react';
import { ActivityLog, LogLevel } from '../types/agent';

interface ActivityLogViewProps {
  logs: ActivityLog[];
  onClearLogs?: () => void;
}

export const ActivityLogView: React.FC<ActivityLogViewProps> = ({ logs, onClearLogs }) => {
  const [filterLevel, setFilterLevel] = useState<LogLevel | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const filteredLogs = logs.filter((log) => {
    const matchesFilter = filterLevel === 'ALL' || log.level === filterLevel;
    const matchesSearch =
      searchQuery === '' ||
      log.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.stepId && log.stepId.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const getLevelBadge = (level: LogLevel) => {
    switch (level) {
      case 'REASONING':
        return <span className="text-purple-400 font-mono text-[10px] px-1.5 py-0.5 rounded bg-purple-950/80 border border-purple-800/60 font-semibold">[AI_THOUGHT]</span>;
      case 'EXEC':
        return <span className="text-cyan-400 font-mono text-[10px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-800/60 font-semibold">[EXEC_DISPATCH]</span>;
      case 'SUCCESS':
        return <span className="text-emerald-400 font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800/60 font-semibold">[GATE_PASS]</span>;
      case 'ARTIFACT':
        return <span className="text-indigo-300 font-mono text-[10px] px-1.5 py-0.5 rounded bg-indigo-950/80 border border-indigo-800/60 font-semibold">[ARTIFACT_VAULT]</span>;
      case 'WARN':
        return <span className="text-amber-400 font-mono text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-800/60 font-semibold">[ADVISORY]</span>;
      default:
        return <span className="text-slate-400 font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 font-semibold">[SYSTEM]</span>;
    }
  };

  const handleExportText = () => {
    const content = logs
      .map((l) => `[${l.timestamp}] [${l.level}] ${l.title} - ${l.message} ${l.simulated ? '(SIMULATED)' : ''}`)
      .join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phoenix_audit_log_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `phoenix_audit_log_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="glass-panel rounded-2xl border-purple-500/20 overflow-hidden shadow-2xl flex flex-col h-[600px]">
      {/* HUD Header & Toolbar */}
      <div className="p-4 bg-slate-950/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <h3 className="font-display font-bold text-sm text-slate-100 uppercase tracking-wider">
            Agent Operational Telemetry Stream
          </h3>
          <span className="text-xs font-mono text-cyan-400 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800">
            {logs.length} Events
          </span>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`px-2.5 py-1 rounded text-xs font-mono border transition-all ${
              autoScroll
                ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                : 'text-slate-500 border-slate-800 hover:text-slate-300'
            }`}
            title="Auto-scroll to latest event"
          >
            Auto-Scroll: {autoScroll ? 'ON' : 'OFF'}
          </button>

          <button
            onClick={handleExportText}
            className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/50 transition-colors"
            title="Export plain text log"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          {onClearLogs && (
            <button
              onClick={onClearLogs}
              className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-500 hover:text-rose-400 transition-colors"
              title="Clear telemetry buffer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 bg-[#0B0D17] border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Log Level Filters */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {(['ALL', 'REASONING', 'EXEC', 'ARTIFACT', 'SUCCESS', 'WARN'] as const).map((lvl) => (
            <button
              key={lvl}
              onClick={() => setFilterLevel(lvl)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all uppercase whitespace-nowrap ${
                filterLevel === lvl
                  ? 'bg-purple-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              {lvl}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-1 sm:w-48 sm:flex-none">
          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search telemetry..."
            className="w-full bg-slate-900/90 border border-slate-800 rounded-lg pl-8 pr-3 py-1 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-400 font-mono"
          />
        </div>
      </div>

      {/* Terminal Content Window */}
      <div
        ref={logContainerRef}
        className="flex-1 p-4 overflow-y-auto space-y-2 bg-[#07080E] font-mono text-xs select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-600 text-center space-y-2">
            <Terminal className="w-8 h-8 opacity-40" />
            <p className="font-mono text-xs">No telemetry logs matching criteria.</p>
          </div>
        ) : (
          filteredLogs.map((log) => (
            <div
              key={log.id}
              className="p-2 rounded hover:bg-slate-900/50 transition-colors flex items-start gap-2.5 leading-relaxed border-l-2 border-transparent hover:border-purple-500"
            >
              <span className="text-slate-500 text-[11px] shrink-0 select-none">
                {log.timestamp}
              </span>
              <div className="shrink-0">{getLevelBadge(log.level)}</div>
              <div className="flex-1 min-w-0">
                <span className="text-slate-200 font-semibold mr-1.5">{log.title}:</span>
                <span className="text-slate-400 font-normal">{log.message}</span>
                {log.simulated && (
                  <span className="ml-2 text-[10px] text-cyan-400/90 bg-cyan-950/60 px-1 rounded border border-cyan-900/50">
                    [SIMULATED]
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
