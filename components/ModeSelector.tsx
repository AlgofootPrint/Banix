'use client';

import { ImageMode } from '@/lib/types';

interface ModeSelectorProps {
  mode: ImageMode;
  onChange: (mode: ImageMode) => void;
}

const MODES: { value: ImageMode; label: string; dims: string }[] = [
  { value: 'banner', label: 'Banner', dims: '2048 × 1152' },
  { value: 'pfp', label: 'Profile Pic', dims: '800 × 800' },
];

export default function ModeSelector({ mode, onChange }: ModeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {MODES.map((m) => {
        const active = mode === m.value;
        const isBanner = m.value === 'banner';
        return (
          <button
            key={m.value}
            onClick={() => onChange(m.value)}
            className={`relative flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
              active
                ? 'bg-zinc-800 border-red-500/40'
                : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40'
            }`}
          >
            {/* Aspect ratio thumbnail */}
            <div className={`shrink-0 flex items-center justify-center rounded-md border transition-colors ${
              active ? 'border-red-500/40 bg-red-950/30' : 'border-zinc-700 bg-zinc-800/60'
            } ${isBanner ? 'w-10 h-[22px]' : 'w-[26px] h-[26px]'}`}>
              <div className={`rounded-sm transition-colors ${active ? 'bg-red-500/70' : 'bg-zinc-600'} ${
                isBanner ? 'w-6 h-[12px]' : 'w-[14px] h-[14px]'
              }`} />
            </div>

            <div className="min-w-0">
              <p className={`text-sm font-semibold leading-none mb-1 transition-colors ${active ? 'text-white' : 'text-zinc-400'}`}>
                {m.label}
              </p>
              <p className={`text-[10px] font-mono leading-none transition-colors truncate ${active ? 'text-zinc-400' : 'text-zinc-600'}`}>
                {m.dims}
              </p>
            </div>

            {active && (
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500" />
            )}
          </button>
        );
      })}
    </div>
  );
}
