'use client';

import { AIMode } from '@/lib/types';

interface Props {
  value: AIMode;
  onChange: (mode: AIMode) => void;
}

const TABS: { id: AIMode; label: string; icon: React.ReactNode }[] = [
  {
    id: 'text2img',
    label: 'Text → Image',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
  },
  {
    id: 'img2img',
    label: 'Image → Image',
    icon: (
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
      </svg>
    ),
  },

];

export default function AIModeTabs({ value, onChange }: Props) {
  return (
    <div>
      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-2">AI Mode</p>
      <div className="flex gap-1.5">
        {TABS.map((tab) => {
          const active = value === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className="flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[10px] font-medium transition-all border"
              style={{
                background: active ? 'rgba(220,38,38,0.12)' : 'transparent',
                borderColor: active ? 'rgba(220,38,38,0.5)' : 'rgb(63,63,70)',
                color: active ? '#f87171' : '#71717a',
              }}
            >
              {tab.icon}
              <span className="leading-tight text-center">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
