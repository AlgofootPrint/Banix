'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { AnalyzeChannelResponse, ChannelSuggestion } from '@/app/api/analyze-channel/route';

function SuggestionCard({
  suggestion,
  onUse,
}: {
  suggestion: ChannelSuggestion;
  onUse: () => void;
}) {
  const isBanner = suggestion.type === 'banner';
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col">
      <div className="h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />
      <div className="p-5 flex flex-col gap-3 flex-1">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
              style={{
                background: isBanner ? 'rgba(220,38,38,0.15)' : 'rgba(59,130,246,0.15)',
                color:      isBanner ? '#f87171' : '#60a5fa',
              }}
            >
              {suggestion.type}
            </span>
            <h3 className="text-sm font-semibold text-white">{suggestion.title}</h3>
          </div>
        </div>

        {/* Prompt */}
        <p className="text-xs text-zinc-400 leading-relaxed flex-1">{suggestion.prompt}</p>

        {/* Reasoning */}
        <p className="text-[11px] text-zinc-600 italic border-t border-zinc-800/60 pt-2.5">
          {suggestion.reasoning}
        </p>

        {/* CTA */}
        <button
          onClick={onUse}
          className="mt-1 w-full py-2 rounded-xl text-xs font-semibold text-white transition-all"
          style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }}
        >
          Use this prompt →
        </button>
      </div>
    </div>
  );
}

export default function AnalyzePage() {
  const router = useRouter();

  const [channelInput, setChannelInput] = useState('');
  const [isLoading, setIsLoading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [result, setResult]             = useState<AnalyzeChannelResponse | null>(null);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (!channelInput.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/analyze-channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelInput }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Analysis failed');
        return;
      }

      setResult(data as AnalyzeChannelResponse);
    } catch {
      setError('Network error. Check your connection.');
    } finally {
      setIsLoading(false);
    }
  }

  function handleUseSuggestion(suggestion: ChannelSuggestion) {
    const params = new URLSearchParams({
      prompt: suggestion.prompt,
      mode:   suggestion.type === 'banner' ? 'banner' : 'pfp',
    });
    router.push(`/?${params.toString()}`);
  }

  const formatCount = (n: string) => {
    const num = parseInt(n ?? '0', 10);
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  return (
    <div className="text-white relative">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(220,38,38,0.07) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Banix</span>
            <span className="text-zinc-700 text-xs">/</span>
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Analyze</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Channel Analyzer</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Paste any YouTube channel URL or @handle — we&apos;ll analyze it and suggest banner &amp; PFP concepts.
          </p>
        </div>

        {/* Input card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/30 mb-8">
          <div className="h-px bg-gradient-to-r from-transparent via-red-600/50 to-transparent" />
          <form onSubmit={handleAnalyze} className="p-5 flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
              placeholder="e.g. @MrBeast  or  youtube.com/channel/UCxxxxxx"
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-zinc-500 transition-colors"
            />
            <button
              type="submit"
              disabled={isLoading || !channelInput.trim()}
              className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0"
              style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }}
            >
              {isLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  Analyze Channel
                </>
              )}
            </button>
          </form>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 rounded-full border-2 border-zinc-800" />
              <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-red-500 animate-spin" />
            </div>
            <div className="text-center">
              <p className="text-sm text-zinc-300 font-medium">Analyzing channel…</p>
              <p className="text-xs text-zinc-600 mt-1">Fetching videos · Running AI analysis</p>
            </div>
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-4 py-3 text-sm text-red-300 mb-6">
            {error}
          </div>
        )}

        {/* Results */}
        {result && !isLoading && (
          <div className="flex flex-col gap-6">

            {/* Channel info card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex items-center gap-4">
              {result.thumbnailUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={result.thumbnailUrl}
                  alt={result.channelName}
                  className="w-16 h-16 rounded-full object-cover shrink-0 ring-2 ring-zinc-700"
                />
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white truncate">{result.channelName}</h2>
                <p className="text-xs text-zinc-400 mt-0.5 line-clamp-2">{result.channelType}</p>
                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs text-zinc-500">
                    <span className="text-zinc-300 font-medium">{formatCount(result.subscriberCount)}</span> subscribers
                  </span>
                  <span className="text-xs text-zinc-500">
                    <span className="text-zinc-300 font-medium">{formatCount(result.videoCount)}</span> videos
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right hidden sm:block">
                <span className="text-[10px] text-zinc-600 uppercase tracking-widest">
                  {result.suggestions.length} suggestions
                </span>
              </div>
            </div>

            {/* Suggestions grid */}
            <div>
              <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest mb-4">
                AI Branding Suggestions
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {result.suggestions.map((s, i) => (
                  <SuggestionCard
                    key={i}
                    suggestion={s}
                    onUse={() => handleUseSuggestion(s)}
                  />
                ))}
              </div>
            </div>

            {/* Analyze another */}
            <div className="text-center pt-2">
              <button
                onClick={() => { setResult(null); setChannelInput(''); }}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2"
              >
                Analyze another channel
              </button>
            </div>
          </div>
        )}

        {/* Empty state hint */}
        {!isLoading && !result && !error && (
          <div className="text-center py-16 flex flex-col items-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center">
              <svg className="w-7 h-7 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
              </svg>
            </div>
            <p className="text-sm text-zinc-500">Enter a YouTube channel to get started</p>
            <p className="text-xs text-zinc-600 max-w-xs">
              Works with @handles, full channel URLs, or channel IDs
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
