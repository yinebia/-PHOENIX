import React, { useState } from 'react';
import { BRAND_CONFIG } from '../config/brand';

export type EmblemSize = 'sm' | 'md' | 'lg' | 'hero';
export type EmblemMood = 'idle' | 'active' | 'celebrating' | 'partial' | 'error';

interface PhoenixEmblemProps {
  size?: EmblemSize;
  mood?: EmblemMood;
  animationsEnabled?: boolean;
  className?: string;
}

const SIZE_CLASSES: Record<EmblemSize, string> = {
  sm: 'w-9 h-9 rounded-xl',
  md: 'w-11 h-11 rounded-xl',
  lg: 'w-16 h-16 rounded-2xl',
  hero: 'w-20 h-20 sm:w-24 sm:h-24 rounded-2xl',
};

export const PhoenixEmblem: React.FC<PhoenixEmblemProps> = ({
  size = 'md',
  mood = 'idle',
  animationsEnabled = true,
  className = '',
}) => {
  const [imgFailed, setImgFailed] = useState(false);

  const ringClass =
    mood === 'celebrating'
      ? 'border-amber-300/80 shadow-[0_0_28px_-4px_rgba(251,191,36,0.55)]'
      : mood === 'active'
      ? 'border-amber-400/60 shadow-[0_0_22px_-4px_rgba(245,158,11,0.4)]'
      : mood === 'partial'
      ? 'border-amber-500/45 shadow-[0_0_16px_-6px_rgba(245,158,11,0.3)]'
      : mood === 'error'
      ? 'border-rose-500/50 shadow-[0_0_16px_-6px_rgba(244,63,94,0.35)]'
      : 'border-amber-400/40 shadow-[0_0_18px_-6px_rgba(245,158,11,0.3)]';

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-[#08090E] border ${ringClass} ${SIZE_CLASSES[size]} ${
        mood === 'celebrating' && animationsEnabled ? 'phoenix-emblem-illuminate' : ''
      } ${className}`}
    >
      {!imgFailed ? (
        <img
          src={BRAND_CONFIG.emblemSrc}
          alt={BRAND_CONFIG.emblemAlt}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover select-none"
        />
      ) : (
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full p-1.5"
          role="img"
          aria-label={BRAND_CONFIG.emblemAlt}
        >
          <defs>
            <linearGradient id="phoenixGoldFallback" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FDE68A" />
              <stop offset="50%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <path
            d="M32 10 L36 20 C43 16 53 12 58 14 C52 24 46 31 37 33 L39 46 L32 56 L25 46 L27 33 C18 31 12 24 6 14 C11 12 21 16 28 20 Z"
            fill="url(#phoenixGoldFallback)"
          />
        </svg>
      )}
      {mood === 'celebrating' && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-amber-500/15 via-transparent to-amber-200/10"
        />
      )}
    </div>
  );
};
