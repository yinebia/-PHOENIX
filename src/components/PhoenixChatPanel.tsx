import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Send,
  Globe,
  Trash2,
  ExternalLink,
  AlertCircle,
  Zap,
  User,
  Lock,
  ArrowRight,
  SlidersHorizontal,
  RefreshCw,
} from 'lucide-react';
import { ChatMessage, ChatRolePreset, Mission } from '../types/agent';
import { apiFetch } from '../services/workspaceService';
import { PhoenixEmblem } from './PhoenixEmblem';

interface PhoenixChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  idToken: string | null;
  actorKey: string;
  currentMission: Mission | null;
  advancedMode?: boolean;
  onLaunchGoalFromChat?: (goalText: string) => void;
}

const ROLE_OPTIONS: Array<{ id: ChatRolePreset; label: string }> = [
  { id: 'strategist', label: 'Execution Strategist' },
  { id: 'researcher', label: 'Search Researcher' },
  { id: 'architect', label: 'Speed & DAG Architect' },
  { id: 'custom', label: 'Custom System Role' },
];

export const PhoenixChatPanel: React.FC<PhoenixChatPanelProps> = ({
  isOpen,
  onClose,
  idToken,
  actorKey,
  currentMission,
  advancedMode = false,
  onLaunchGoalFromChat,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState<'gemini-4-hydrogen' | 'gemini-3.1-flash-lite'>('gemini-3.1-flash-lite');
  const [rolePreset, setRolePreset] = useState<ChatRolePreset>('strategist');
  const [customInstruction, setCustomInstruction] = useState('');
  const [useSearchGrounding, setUseSearchGrounding] = useState(false);
  const [includeMissionContext, setIncludeMissionContext] = useState(true);
  const [showTechControls, setShowTechControls] = useState(false);
  const [aiConnected, setAiConnected] = useState<boolean>(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [failedRetryText, setFailedRetryText] = useState<string | null>(null);
  const [canRetryError, setCanRetryError] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setMessages([]);
    setErrorMsg(null);
  }, [actorKey]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const res = await apiFetch('/api/chat/history', { method: 'GET' }, idToken);
        const data = await res.json();
        if (!active) return;
        if (res.ok) {
          setMessages(Array.isArray(data.history) ? data.history : []);
          setAiConnected(data.aiConnected !== false);
        } else {
          setErrorMsg(data.error || 'Unable to load conversation history.');
        }
      } catch (err: any) {
        if (active) setErrorMsg(err?.message || 'Unable to connect to chat service.');
      } finally {
        if (active) setIsLoadingHistory(false);
      }
    };
    void loadHistory();
    return () => {
      active = false;
    };
  }, [isOpen, idToken, actorKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  if (!isOpen) return null;

  const handleClearChat = async () => {
    setErrorMsg(null);
    try {
      const res = await apiFetch('/api/chat/history', { method: 'DELETE' }, idToken);
      if (res.ok) {
        setMessages([]);
      } else {
        const data = await res.json();
        setErrorMsg(data.error || 'Failed to clear conversation.');
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to clear conversation.');
    }
  };

  const buildMissionContextString = () => {
    if (!includeMissionContext || !currentMission) return undefined;
    const done = currentMission.tasks.filter((t) => t.status === 'completed').length;
    return [
      `Active Project: ${currentMission.title}`,
      `Goal: ${currentMission.goal}`,
      `Status: ${currentMission.status} (${done}/${currentMission.tasks.length} steps finished)`,
      currentMission.understanding?.intendedOutcome
        ? `Outcome: ${currentMission.understanding.intendedOutcome}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');
  };

  const sendPrompt = async (promptText: string) => {
    const trimmed = promptText.trim();
    if (!trimmed || isSending) return;

    setErrorMsg(null);
    setFailedRetryText(null);
    setCanRetryError(false);
    setIsSending(true);
    setInput('');

    const optimisticUserMsg: ChatMessage = {
      id: `opt-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticUserMsg]);

    try {
      const effectiveModel = useSearchGrounding ? 'gemini-4-hydrogen' : model;
      const res = await apiFetch(
        '/api/chat',
        {
          method: 'POST',
          body: JSON.stringify({
            message: trimmed,
            model: effectiveModel,
            systemPreset: rolePreset,
            customInstruction: rolePreset === 'custom' ? customInstruction : undefined,
            useSearchGrounding,
            missionContext: buildMissionContextString(),
          }),
        },
        idToken
      );

      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || `Request failed (${res.status}).`);
        setCanRetryError(data.safeToRetry !== false && res.status !== 401 && res.status !== 403);
        setFailedRetryText(trimmed);
        setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
        setInput(trimmed);
        return;
      }

      if (Array.isArray(data.history)) {
        const nextHistory: ChatMessage[] = data.history;
        if (data.searchFallbackNotice && nextHistory.length > 0) {
          const lastIdx = nextHistory.length - 1;
          nextHistory[lastIdx] = {
            ...nextHistory[lastIdx],
            searchFallbackNotice: data.searchFallbackNotice,
          };
        }
        setMessages(nextHistory);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `m-${Date.now()}`,
            role: 'model',
            text: data.reply,
            timestamp: new Date().toISOString(),
            model: data.modelUsed,
            latencyMs: data.latencyMs,
            searchGrounded: data.searchGrounded,
            searchFallbackNotice: data.searchFallbackNotice,
            groundingSources: data.groundingSources,
          },
        ]);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to reach PHOENIX assistant.');
      setCanRetryError(true);
      setFailedRetryText(trimmed);
      setMessages((prev) => prev.filter((m) => m.id !== optimisticUserMsg.id));
      setInput(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    await sendPrompt(input);
  };

  const latestUserIdea = [...messages].reverse().find((m) => m.role === 'user')?.text;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-[#0B0D17] border-l border-amber-500/20 h-full flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-[#090A12]">
          <div className="flex items-center gap-3 min-w-0">
            <PhoenixEmblem size="sm" mood={isSending ? 'active' : 'idle'} />
            <div className="min-w-0">
              <h3 className="font-display font-bold text-sm sm:text-base text-white truncate">
                Chat with PHOENIX
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                {currentMission
                  ? `Aware of your active project: ${currentMission.title}`
                  : 'Ask anything, explore an idea, or check live web facts'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {advancedMode && (
              <button
                type="button"
                onClick={() => setShowTechControls((v) => !v)}
                className={`min-h-[40px] px-2.5 rounded-lg text-xs font-mono border flex items-center gap-1 cursor-pointer ${
                  showTechControls
                    ? 'bg-purple-600/25 border-purple-400/60 text-purple-200'
                    : 'text-slate-400 border-slate-800 hover:text-white'
                }`}
                title="Toggle model and prompt settings"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Settings</span>
              </button>
            )}
            {messages.length > 0 && (
              <button
                type="button"
                onClick={handleClearChat}
                className="min-h-[40px] px-2.5 rounded-lg text-xs text-slate-400 hover:text-rose-300 hover:bg-rose-950/30 border border-slate-800 flex items-center gap-1 cursor-pointer"
                title="Clear conversation history"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] min-w-[40px] p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer flex items-center justify-center"
              aria-label="Close chat"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Optional Simple Context Bar (Advanced settings tucked behind toggle in Advanced Mode) */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-950/75 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-1.5 text-cyan-200 cursor-pointer">
              <input
                type="checkbox"
                checked={useSearchGrounding}
                onChange={(e) => setUseSearchGrounding(e.target.checked)}
                className="accent-amber-400 rounded"
              />
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Include live web search</span>
            </label>

            {currentMission && (
              <label className="flex items-center gap-1.5 text-amber-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMissionContext}
                  onChange={(e) => setIncludeMissionContext(e.target.checked)}
                  className="accent-amber-400 rounded"
                />
                <span>Use current project context</span>
              </label>
            )}
          </div>

          {onLaunchGoalFromChat && latestUserIdea && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onLaunchGoalFromChat(latestUserIdea);
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/40 text-amber-200 text-xs font-medium flex items-center gap-1.5 cursor-pointer"
            >
              <span>Turn last idea into a guided project</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {advancedMode && showTechControls && (
          <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 space-y-2.5 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Free-Tier Model
                </label>
                <select
                  value={model}
                  onChange={(e) =>
                    setModel(e.target.value as 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite')
                  }
                  className="w-full bg-[#07080E] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
                >
                  <option value="gemini-4-hydrogen">Gemini 4 Flash (General + Search)</option>
                  <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Fast)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-mono uppercase text-slate-400 block mb-1">
                  Assistant Role
                </label>
                <select
                  value={rolePreset}
                  onChange={(e) => setRolePreset(e.target.value as ChatRolePreset)}
                  className="w-full bg-[#07080E] border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs font-mono text-slate-200"
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {rolePreset === 'custom' && (
              <textarea
                value={customInstruction}
                onChange={(e) => setCustomInstruction(e.target.value)}
                rows={2}
                placeholder="Enter custom system instruction..."
                className="w-full bg-[#07080E] border border-slate-700/80 rounded-lg px-3 py-2 text-xs text-slate-200 resize-none"
              />
            )}
            <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Free-tier routing active
            </span>
          </div>
        )}

        {/* Message List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {isLoadingHistory ? (
            <div className="py-12 text-center text-xs text-slate-400">
              Loading your conversation...
            </div>
          ) : messages.length === 0 ? (
            <div className="py-10 px-4 text-center space-y-4 max-w-md mx-auto">
              <div className="flex justify-center">
                <PhoenixEmblem size="lg" mood="idle" />
              </div>
              <h4 className="font-display font-bold text-base text-white">
                How can we help right now?
              </h4>
              <p className="text-xs sm:text-sm text-slate-400 font-sans leading-relaxed">
                Brainstorm an idea, ask questions about your active project, or ask me to check real information online.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1">
                {[
                  'Help me brainstorm a small business idea under $200',
                  'Check realistic cloud hosting options for a starter website',
                  'What should I consider before launching a new service?',
                ].map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => setInput(prompt)}
                    className="min-h-[40px] px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-sans text-amber-200/90 cursor-pointer text-left"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} space-y-1.5`}
                >
                  <div className="flex items-center gap-2 text-[11px] text-slate-400">
                    {isUser ? (
                      <>
                        <span>You</span>
                        <User className="w-3 h-3 text-purple-300" />
                      </>
                    ) : (
                      <>
                        <span className="text-amber-300 font-semibold">PHOENIX</span>
                        {advancedMode && msg.model && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-400">
                            {msg.model}
                          </span>
                        )}
                        {advancedMode && typeof msg.latencyMs === 'number' && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-mono text-emerald-300 tabular-nums">
                            <Zap className="w-2.5 h-2.5" />
                            {msg.latencyMs}ms
                          </span>
                        )}
                        {msg.searchGrounded && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300">
                            <Globe className="w-3 h-3" />
                            <span>Web sources checked</span>
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  <div
                    className={`max-w-[90%] rounded-2xl px-4 py-3 text-xs sm:text-sm font-sans leading-relaxed whitespace-pre-wrap ${
                      isUser
                        ? 'bg-purple-600/25 border border-purple-500/40 text-white'
                        : 'bg-slate-900/90 border border-slate-800 text-slate-200'
                    }`}
                  >
                    {msg.text}

                    {msg.groundingSources && msg.groundingSources.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-slate-800 space-y-1.5">
                        <div className="text-[11px] text-cyan-300 flex items-center gap-1 font-medium">
                          <Globe className="w-3 h-3" />
                          <span>Sources checked ({msg.groundingSources.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {msg.groundingSources.map((src, idx) => (
                            <a
                              key={`${src.uri}-${idx}`}
                              href={src.uri}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-950 hover:bg-cyan-950/60 border border-slate-700 text-[11px] text-cyan-300 max-w-full"
                            >
                              <span className="truncate max-w-[220px]">{src.title}</span>
                              <ExternalLink className="w-3 h-3 shrink-0" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {isSending && (
            <div className="flex items-center gap-2 text-xs text-amber-200 bg-slate-900/70 border border-slate-800 rounded-xl px-4 py-3 max-w-xs">
              <div className="w-3.5 h-3.5 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
              <span>Thinking...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-5 mb-2 p-3 rounded-xl bg-rose-950/60 border border-rose-700/60 text-xs text-rose-200 flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {canRetryError && failedRetryText && (
                <button
                  type="button"
                  disabled={isSending}
                  onClick={() => void sendPrompt(failedRetryText)}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-200 font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setFailedRetryText(null);
                }}
                className="text-rose-300 hover:text-white text-xs cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={handleSend}
          className="p-4 border-t border-slate-800 bg-[#090A12] flex items-end gap-2.5"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={2}
            placeholder="Write a message or follow-up thought... (Enter to send)"
            className="flex-1 bg-[#07080E] border border-slate-700/80 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-400 resize-none font-sans"
          />
          <button
            type="submit"
            disabled={isSending || !input.trim()}
            className="min-h-[44px] px-4 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 font-display font-bold text-xs flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0"
          >
            <Send className="w-4 h-4" />
            <span>Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
