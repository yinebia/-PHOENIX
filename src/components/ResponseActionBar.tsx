import React, { useState } from 'react';
import {
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  Volume2,
  Pause,
  Play,
  Square,
  AlertCircle,
} from 'lucide-react';
import { ResponseFeedbackRating } from '../types/agent';
import { SpeechState } from '../utils/speech';

interface ResponseActionBarProps {
  responseId: string;
  missionId: string;
  label?: string;
  textToCopy: string;
  textToSpeak?: string;
  currentRating?: ResponseFeedbackRating;
  onRate?: (
    responseId: string,
    rating: ResponseFeedbackRating | null,
    label?: string,
    snippet?: string
  ) => void;
  speechState: SpeechState;
  onSpeak?: (responseId: string, text: string, label?: string) => void;
  onPauseSpeech?: () => void;
  onResumeSpeech?: () => void;
  onStopSpeech?: () => void;
}

export const ResponseActionBar: React.FC<ResponseActionBarProps> = ({
  responseId,
  label = 'AI Output',
  textToCopy,
  textToSpeak,
  currentRating,
  onRate,
  speechState,
  onSpeak,
  onPauseSpeech,
  onResumeSpeech,
  onStopSpeech,
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const speakableText = textToSpeak ?? textToCopy;
  const isThisActive = speechState.activeId === responseId;
  const isPlayingThis = isThisActive && speechState.status === 'playing';
  const isPausedThis = isThisActive && speechState.status === 'paused';

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      if (!navigator?.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(textToCopy);
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
      setTimeout(() => setCopyState('idle'), 2500);
    }
  };

  const handleVote = (e: React.MouseEvent, target: ResponseFeedbackRating) => {
    e.stopPropagation();
    if (!onRate) return;
    // Toggle off if clicking already active vote so duplicate votes never inflate totals
    const nextRating = currentRating === target ? null : target;
    onRate(responseId, nextRating, label, textToCopy.slice(0, 140));
  };

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-slate-800/70 text-[11px] font-mono"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Copy Control */}
        <button
          type="button"
          onClick={handleCopy}
          title="Copy formatted response"
          className={`px-2 py-1 rounded-md border flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
            copyState === 'copied'
              ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
              : copyState === 'error'
              ? 'bg-rose-950/70 border-rose-500/60 text-rose-300'
              : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-100 hover:border-slate-700'
          }`}
        >
          {copyState === 'copied' ? (
            <>
              <Check className="w-3 h-3" />
              <span>Copied</span>
            </>
          ) : copyState === 'error' ? (
            <>
              <AlertCircle className="w-3 h-3" />
              <span>Copy Failed</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </button>

        {/* Like & Dislike Quality Feedback Controls */}
        {onRate && (
          <div className="flex items-center gap-1" role="group" aria-label={`Feedback for ${label}`}>
            <button
              type="button"
              onClick={(e) => handleVote(e, 'up')}
              aria-pressed={currentRating === 'up'}
              title="Helpful response"
              className={`px-2 py-1 rounded-md border flex items-center gap-1 transition-colors cursor-pointer ${
                currentRating === 'up'
                  ? 'bg-emerald-950/70 border-emerald-500/60 text-emerald-300'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-emerald-300 hover:border-slate-700'
              }`}
            >
              <ThumbsUp className="w-3 h-3" />
              {currentRating === 'up' && <span>Liked</span>}
            </button>
            <button
              type="button"
              onClick={(e) => handleVote(e, 'down')}
              aria-pressed={currentRating === 'down'}
              title="Needs improvement"
              className={`px-2 py-1 rounded-md border flex items-center gap-1 transition-colors cursor-pointer ${
                currentRating === 'down'
                  ? 'bg-rose-950/70 border-rose-500/60 text-rose-300'
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-rose-300 hover:border-slate-700'
              }`}
            >
              <ThumbsDown className="w-3 h-3" />
              {currentRating === 'down' && <span>Flagged</span>}
            </button>
          </div>
        )}

        {/* Listen / Speech Playback Controls */}
        {!speechState.supported ? (
          <button
            type="button"
            disabled
            title="Text-to-speech is not supported in this browser"
            className="px-2 py-1 rounded-md border bg-slate-950 border-slate-800/80 text-slate-600 flex items-center gap-1 cursor-not-allowed whitespace-nowrap"
          >
            <Volume2 className="w-3 h-3" />
            <span>Voice N/A</span>
          </button>
        ) : isPlayingThis ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onPauseSpeech?.();
              }}
              className="px-2 py-1 rounded-md border bg-cyan-950/70 border-cyan-500/60 text-cyan-200 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Pause className="w-3 h-3" />
              <span>Pause</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStopSpeech?.();
              }}
              className="px-2 py-1 rounded-md border bg-slate-900 border-slate-700 text-slate-300 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Square className="w-3 h-3" />
              <span>Stop</span>
            </button>
          </div>
        ) : isPausedThis ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResumeSpeech?.();
              }}
              className="px-2 py-1 rounded-md border bg-cyan-950/70 border-cyan-500/60 text-cyan-200 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Play className="w-3 h-3" />
              <span>Resume</span>
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onStopSpeech?.();
              }}
              className="px-2 py-1 rounded-md border bg-slate-900 border-slate-700 text-slate-300 hover:text-rose-300 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Square className="w-3 h-3" />
              <span>Stop</span>
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onSpeak?.(responseId, speakableText, label);
            }}
            className="px-2 py-1 rounded-md border bg-slate-900/80 border-slate-800 text-slate-400 hover:text-cyan-300 hover:border-cyan-700/60 flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
          >
            <Volume2 className="w-3 h-3" />
            <span>Listen</span>
          </button>
        )}
      </div>

      {isThisActive && (
        <span className="text-[10px] text-cyan-300 font-semibold">
          {speechState.status === 'playing' ? 'Speaking aloud...' : 'Speech paused'}
        </span>
      )}
    </div>
  );
};
