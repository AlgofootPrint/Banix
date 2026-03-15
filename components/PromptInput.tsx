'use client';

import { ImageMode } from '@/lib/types';

const MAX_CHARS = 300;

const PLACEHOLDERS: Record<ImageMode, string> = {
  banner: 'e.g. "Mountain landscape at sunset with purple sky and fog in the valley"',
  pfp: 'e.g. "Cartoon astronaut helmet, space background, vibrant colors"',
};

interface PromptInputProps {
  value: string;
  mode: ImageMode;
  onChange: (value: string) => void;
}

export default function PromptInput({ value, mode, onChange }: PromptInputProps) {
  const remaining = MAX_CHARS - value.length;
  const pct = (value.length / MAX_CHARS) * 100;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
          Prompt
        </label>
        <span className={`text-[11px] font-mono tabular-nums transition-colors ${remaining < 30 ? 'text-red-400' : 'text-zinc-600'}`}>
          {remaining}
        </span>
      </div>

      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, MAX_CHARS))}
          placeholder={PLACEHOLDERS[mode]}
          rows={3}
          className="w-full bg-zinc-800/50 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 resize-none focus:outline-none focus:border-red-500/50 focus:bg-zinc-800 transition-all leading-relaxed"
        />
        {value.length > 0 && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] rounded-b-xl overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${pct > 90 ? 'bg-red-500' : 'bg-zinc-600'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>

      <p className="text-[11px] text-zinc-600 leading-relaxed">
        Optional — leave blank to use only the style preset.
      </p>
    </div>
  );
}
