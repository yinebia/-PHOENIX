/**
 * Browser Web Speech API manager for PHOENIX conversational response playback.
 * Strips UI labels/markdown/HTML noise and degrades gracefully when speechSynthesis is unsupported.
 */

export type SpeechStatus = 'idle' | 'playing' | 'paused' | 'error';

export interface SpeechQueueItem {
  id: string;
  label?: string;
  text: string;
}

export interface SpeechState {
  supported: boolean;
  status: SpeechStatus;
  activeId: string | null;
  isSequence: boolean;
  queueIndex: number;
  queueTotal: number;
  error: string | null;
}

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  );
}

/**
 * Strips markdown symbols, HTML tags, URLs, and internal telemetry tags so only clean prose is spoken.
 */
export function sanitizeTextForSpeech(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\[(?:REAL TOOL EXECUTION|LIVE AI REASONING|AUDITED V2|SIMULATED|APPROVAL_GATE|RETRY|ERROR)[^\]]*\]/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/gi, 'link')
    .replace(/(^|\s)#{1,6}\s+/g, '$1')
    .replace(/[`*_~>|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Listener = (state: SpeechState) => void;

class PhoenixSpeechController {
  private listeners = new Set<Listener>();
  private queue: SpeechQueueItem[] = [];
  private currentIndex = -1;
  private state: SpeechState = {
    supported: isSpeechSupported(),
    status: 'idle',
    activeId: null,
    isSequence: false,
    queueIndex: 0,
    queueTotal: 0,
    error: null,
  };

  getState(): SpeechState {
    return { ...this.state, supported: isSpeechSupported() };
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(patch: Partial<SpeechState>) {
    this.state = {
      ...this.state,
      ...patch,
      supported: isSpeechSupported(),
    };
    const snapshot = this.getState();
    this.listeners.forEach((fn) => fn(snapshot));
  }

  speakSingle(item: SpeechQueueItem) {
    this.startQueue([item], false);
  }

  speakSequence(items: SpeechQueueItem[]) {
    const valid = items.filter((i) => sanitizeTextForSpeech(i.text).length > 0);
    if (valid.length === 0) {
      this.emit({
        status: 'error',
        error: 'No readable AI response text available in this mission yet.',
      });
      return;
    }
    this.startQueue(valid, true);
  }

  private startQueue(items: SpeechQueueItem[], isSequence: boolean) {
    if (!isSpeechSupported()) {
      this.emit({
        status: 'error',
        activeId: null,
        error: 'Browser speech synthesis is unavailable in this environment.',
      });
      return;
    }

    try {
      window.speechSynthesis.cancel();
    } catch {}

    this.queue = items;
    this.currentIndex = 0;
    this.playItemAtIndex(0, isSequence);
  }

  private playItemAtIndex(idx: number, isSequence: boolean) {
    if (idx < 0 || idx >= this.queue.length) {
      this.queue = [];
      this.currentIndex = -1;
      this.emit({
        status: 'idle',
        activeId: null,
        isSequence: false,
        queueIndex: 0,
        queueTotal: 0,
        error: null,
      });
      return;
    }

    const item = this.queue[idx];
    const cleanText = sanitizeTextForSpeech(item.text);
    if (!cleanText) {
      this.playItemAtIndex(idx + 1, isSequence);
      return;
    }

    try {
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.rate = 1.02;
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        this.emit({
          status: 'playing',
          activeId: item.id,
          isSequence,
          queueIndex: idx + 1,
          queueTotal: this.queue.length,
          error: null,
        });
      };

      utterance.onend = () => {
        // Ignore stale end events if user stopped or started another item
        if (this.currentIndex !== idx || this.state.activeId !== item.id) return;
        const nextIdx = idx + 1;
        if (nextIdx < this.queue.length) {
          this.currentIndex = nextIdx;
          this.playItemAtIndex(nextIdx, isSequence);
        } else {
          this.stop();
        }
      };

      utterance.onerror = (evt: any) => {
        if (evt?.error === 'canceled' || evt?.error === 'interrupted') return;
        this.queue = [];
        this.currentIndex = -1;
        this.emit({
          status: 'error',
          activeId: null,
          isSequence: false,
          queueIndex: 0,
          queueTotal: 0,
          error: `Audio playback unavailable (${evt?.error || 'speech synthesis error'}).`,
        });
      };

      this.emit({
        status: 'playing',
        activeId: item.id,
        isSequence,
        queueIndex: idx + 1,
        queueTotal: this.queue.length,
        error: null,
      });
      window.speechSynthesis.speak(utterance);
    } catch (err: any) {
      this.emit({
        status: 'error',
        activeId: null,
        error: err?.message || 'Unable to start speech playback.',
      });
    }
  }

  pause() {
    if (!isSpeechSupported() || this.state.status !== 'playing') return;
    try {
      window.speechSynthesis.pause();
      this.emit({ status: 'paused' });
    } catch {}
  }

  resume() {
    if (!isSpeechSupported() || this.state.status !== 'paused') return;
    try {
      window.speechSynthesis.resume();
      this.emit({ status: 'playing' });
    } catch {}
  }

  stop() {
    this.queue = [];
    this.currentIndex = -1;
    if (isSpeechSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    this.emit({
      status: 'idle',
      activeId: null,
      isSequence: false,
      queueIndex: 0,
      queueTotal: 0,
      error: null,
    });
  }
}

export const speechController = new PhoenixSpeechController();
