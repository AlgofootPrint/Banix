'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ImageMode, AIMode } from '@/lib/types';
import ModeSelector from '@/components/ModeSelector';
import StylePresets from '@/components/StylePresets';
import PromptInput from '@/components/PromptInput';
import ImagePreview from '@/components/ImagePreview';
import AIModeTabs from '@/components/AIModeTabs';
import ImageUpload from '@/components/ImageUpload';
import InpaintCanvas from '@/components/InpaintCanvas';
import { createClient } from '@/lib/supabase/client';

interface ErrorState {
  message: string;
  type: 'rateLimit' | 'modelLoading' | 'error';
}

interface UsageData {
  plan: string;
  bannerCount: number;
  pfpCount: number;
  bannerLimit: number;
  pfpLimit: number;
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [mode, setMode] = useState<ImageMode>('banner');
  const [aiMode, setAIMode] = useState<AIMode>('text2img');
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [maskImage, setMaskImage] = useState<string | null>(null);
  const [strength, setStrength] = useState(0.65);
  const [prompt, setPrompt] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorState | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'error' | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [safeZoneDefault, setSafeZoneDefault] = useState(true);

  const prevImageUrlRef = useRef<string | null>(null);
  // Keep blob ref so we can upload the original blob
  const currentBlobRef = useRef<Blob | null>(null);

  const fetchUsage = useCallback(async () => {
    try {
      const res = await fetch('/api/usage');
      if (res.ok) {
        const data: UsageData = await res.json();
        setUsage(data);
      }
    } catch {
      // non-critical — silently ignore
    }
  }, []);

  // Pre-fill from channel analyzer redirect (?prompt=...&mode=...)
  useEffect(() => {
    const p = searchParams.get('prompt');
    const m = searchParams.get('mode');
    if (p) setPrompt(p);
    if (m === 'banner' || m === 'pfp') setMode(m);
  }, [searchParams]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
    fetchUsage();

    // Apply saved generation preferences
    try {
      const raw = localStorage.getItem('banix_gen_prefs');
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs.defaultMode) setMode(prefs.defaultMode);
        if (prefs.defaultPreset && prefs.defaultPreset !== 'none') setSelectedPreset(prefs.defaultPreset);
        if (typeof prefs.safeZoneDefault === 'boolean') setSafeZoneDefault(prefs.safeZoneDefault);
      }
    } catch {}
  }, [fetchUsage]);

  useEffect(() => {
    const prev = prevImageUrlRef.current;
    if (prev && prev !== imageUrl) URL.revokeObjectURL(prev);
    prevImageUrlRef.current = imageUrl;
    setSaveStatus(null);
  }, [imageUrl]);

  function handleModeChange(newMode: ImageMode) {
    setMode(newMode);
    setImageUrl(null);
    setError(null);
    currentBlobRef.current = null;
  }

  function handleAIModeChange(newAIMode: AIMode) {
    setAIMode(newAIMode);
    setSourceImage(null);
    setMaskImage(null);
    setError(null);
    setStrength(newAIMode === 'inpaint' ? 0.99 : 0.65);
  }

  async function handleGenerate() {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    currentBlobRef.current = null;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const raw = localStorage.getItem('banix_api_token');
        if (raw) {
          const { token } = JSON.parse(raw);
          if (token) headers['x-api-token'] = token;
        }
      } catch {}

      const res = await fetch('/api/generate', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          prompt,
          mode,
          presetId: selectedPreset,
          aiMode,
          sourceImage: sourceImage ?? undefined,
          maskImage: maskImage ?? undefined,
          strength,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.limitReached) {
          setError({ message: `Daily limit reached (${data.limit} per day on ${data.plan} plan). Upgrade for more.`, type: 'rateLimit' });
          fetchUsage();
        } else if (data.rateLimited) {
          setError({ message: `Rate limit reached. Try again in ~${data.retryAfterSeconds ?? 60}s`, type: 'rateLimit' });
        } else if (data.modelLoading) {
          setError({ message: `Model is loading. Try again in ~${data.retryAfterSeconds ?? 30}s`, type: 'modelLoading' });
        } else {
          setError({ message: data.error ?? 'Generation failed', type: 'error' });
        }
        return;
      }

      const blob = await res.blob();
      currentBlobRef.current = blob;
      setImageUrl(URL.createObjectURL(blob));
      fetchUsage();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError({ message: msg || 'Network error. Check your connection.', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    if (!imageUrl || !currentBlobRef.current) return;

    if (!userId) {
      router.push('/auth');
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    try {
      const timestamp = Date.now();
      const path = `${userId}/${timestamp}.png`;

      const { error: uploadError } = await supabase.storage
        .from('saved-images')
        .upload(path, currentBlobRef.current, { contentType: 'image/png' });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('saved-images')
        .getPublicUrl(path);

      const { error: dbError } = await supabase.from('saved_images').insert({
        user_id: userId,
        prompt: prompt || null,
        mode,
        preset_id: selectedPreset,
        storage_path: path,
        public_url: publicUrl,
      });

      if (dbError) throw dbError;

      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  }

  const errorStyles: Record<ErrorState['type'], string> = {
    rateLimit:    'bg-yellow-900/40 border-yellow-600/50 text-yellow-300',
    modelLoading: 'bg-blue-900/40 border-blue-600/50 text-blue-300',
    error:        'bg-red-900/40 border-red-600/50 text-red-300',
  };

  return (
    <div className="text-white relative">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(220,38,38,0.07) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* ── Page header ─────────────────────── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Banix</span>
            <span className="text-zinc-700 text-xs">/</span>
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Image Generator</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Create AI-powered banners and profile pictures for your YouTube channel.
          </p>
        </div>

        {/* ── Two-panel layout ────────────────── */}
        <div className="flex flex-col md:flex-row gap-5 items-start">

          {/* ── Left: controls card ─────────── */}
          <div className="w-full md:w-[320px] lg:w-[380px] shrink-0 md:sticky md:top-[57px] lg:top-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
              {/* Top accent */}
              <div className="h-px bg-gradient-to-r from-transparent via-red-600/50 to-transparent" />

              <div className="p-5 flex flex-col gap-5">
                <ModeSelector mode={mode} onChange={handleModeChange} />

                <div className="h-px bg-zinc-800/80" />

                <AIModeTabs value={aiMode} onChange={handleAIModeChange} />

                {/* Image upload for img2img and inpaint */}
                {(aiMode === 'img2img' || aiMode === 'inpaint') && (
                  <ImageUpload
                    value={sourceImage}
                    onChange={(v) => { setSourceImage(v); setMaskImage(null); }}
                    label="Source Image"
                  />
                )}

                {/* Strength slider — img2img only */}
                {aiMode === 'img2img' && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
                        Creativity
                      </p>
                      <span className="text-[11px] font-mono text-zinc-400">
                        {Math.round(strength * 100)}%
                        <span className="text-zinc-600 ml-1.5">
                          {strength <= 0.4 ? '· subtle' : strength <= 0.65 ? '· balanced' : '· strong'}
                        </span>
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.1}
                      max={0.95}
                      step={0.05}
                      value={strength}
                      onChange={(e) => setStrength(parseFloat(e.target.value))}
                      className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #dc2626 0%, #dc2626 ${(strength - 0.1) / 0.85 * 100}%, #3f3f46 ${(strength - 0.1) / 0.85 * 100}%, #3f3f46 100%)`,
                      }}
                    />
                    <div className="flex justify-between text-[10px] text-zinc-600 mt-1">
                      <span>Faithful</span>
                      <span>Creative</span>
                    </div>
                  </div>
                )}

                {/* Inpaint mask canvas */}
                {aiMode === 'inpaint' && sourceImage && (
                  <InpaintCanvas
                    sourceImage={sourceImage}
                    onMaskChange={setMaskImage}
                  />
                )}

                <div className="h-px bg-zinc-800/80" />

                <StylePresets selected={selectedPreset} onSelect={setSelectedPreset} />

                <div className="h-px bg-zinc-800/80" />

                <PromptInput value={prompt} mode={mode} onChange={setPrompt} />

                {/* Generate button */}
                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="relative w-full py-3 rounded-xl text-sm font-semibold overflow-hidden group disabled:cursor-not-allowed transition-all"
                  style={{
                    background: isLoading
                      ? 'rgb(39 39 42)'
                      : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                    boxShadow: isLoading ? 'none' : '0 0 24px rgba(220,38,38,0.25)',
                  }}
                >
                  {!isLoading && (
                    <span
                      aria-hidden
                      className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    />
                  )}
                  <span className="relative flex items-center justify-center gap-2 text-white">
                    {isLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                        </svg>
                        Generate
                      </>
                    )}
                  </span>
                </button>

                {/* Usage counter */}
                {usage && (
                  <div className="flex items-center justify-between text-xs text-zinc-500 px-0.5">
                    <span>
                      {mode === 'banner' ? (
                        <>
                          <span className={usage.bannerCount >= usage.bannerLimit ? 'text-red-400 font-medium' : 'text-zinc-400'}>
                            {usage.bannerCount}
                          </span>
                          <span> / {usage.bannerLimit} banners today</span>
                        </>
                      ) : (
                        <>
                          <span className={usage.pfpCount >= usage.pfpLimit ? 'text-red-400 font-medium' : 'text-zinc-400'}>
                            {usage.pfpCount}
                          </span>
                          <span> / {usage.pfpLimit} profile pics today</span>
                        </>
                      )}
                    </span>
                    {((mode === 'banner' && usage.bannerCount >= usage.bannerLimit) ||
                      (mode === 'pfp' && usage.pfpCount >= usage.pfpLimit)) && (
                      <Link
                        href="/pricing"
                        className="text-red-400 hover:text-red-300 font-medium transition-colors underline underline-offset-2"
                      >
                        Upgrade
                      </Link>
                    )}
                  </div>
                )}

                {/* Save button — only shown after generation */}
                {imageUrl && (
                  <button
                    onClick={handleSave}
                    disabled={isSaving || saveStatus === 'saved'}
                    className="w-full py-2.5 rounded-xl text-sm font-medium border transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{
                      borderColor: saveStatus === 'saved' ? '#16a34a' : saveStatus === 'error' ? '#dc2626' : '#3f3f46',
                      color: saveStatus === 'saved' ? '#4ade80' : saveStatus === 'error' ? '#f87171' : '#a1a1aa',
                      background: 'transparent',
                    }}
                  >
                    {isSaving ? (
                      <>
                        <span className="w-3.5 h-3.5 border-2 border-zinc-500/30 border-t-zinc-400 rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : saveStatus === 'saved' ? (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                        Saved
                      </>
                    ) : saveStatus === 'error' ? (
                      'Save failed — retry'
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                        </svg>
                        {userId ? 'Save Image' : 'Log in to Save'}
                      </>
                    )}
                  </button>
                )}

                {error && (
                  <div className={`border rounded-xl px-4 py-3 text-xs leading-relaxed ${errorStyles[error.type]}`}>
                    {error.message}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: preview panel ────────── */}
          <div className="flex-1 min-w-0 w-full">
            <ImagePreview
              imageUrl={imageUrl}
              mode={mode}
              isLoading={isLoading}
              presetId={selectedPreset}
              safeZoneDefault={safeZoneDefault}
            />
          </div>

        </div>

        {/* ── Footer ──────────────────────────── */}
        <footer className="mt-10 pt-6 border-t border-zinc-800/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-zinc-600">
            BANIX™ — created by <span className="text-zinc-500">Dupont</span>
          </p>
          <div className="flex items-center gap-4">
            <a href="https://x.com/MLdupont" target="_blank" rel="noopener noreferrer" aria-label="X / Twitter" className="text-zinc-600 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a href="https://github.com/Algofootprint" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="text-zinc-600 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
              </svg>
            </a>
            <a href="https://www.instagram.com/algofootprint" target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="text-zinc-600 hover:text-white transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
              </svg>
            </a>
          </div>
        </footer>

      </div>
    </div>
  );
}
