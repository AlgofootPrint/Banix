'use client';

import { useState } from 'react';
import { ImageMode } from '@/lib/types';
import { downloadAsYouTubePNG } from '@/lib/canvasResize';
import SafeZoneOverlay from './SafeZoneOverlay';
import CropEditor from './CropEditor';

interface ImagePreviewProps {
  imageUrl: string | null;
  mode: ImageMode;
  isLoading: boolean;
  safeZoneDefault?: boolean;
  presetId?: string | null;
}

export default function ImagePreview({ imageUrl, mode, isLoading, safeZoneDefault = true, presetId }: ImagePreviewProps) {
  const [showSafeZone, setShowSafeZone] = useState(safeZoneDefault);
  const [cropOpen, setCropOpen] = useState(false);
  const isBanner = mode === 'banner';

  const containerClass = isBanner
    ? 'w-full aspect-[16/9]'
    : 'w-full max-w-[320px] aspect-square mx-auto';

  function handleDownload() {
    if (!imageUrl) return;
    let filenamePattern: string | undefined;
    let format: 'png' | 'webp' | undefined;
    try {
      const raw = localStorage.getItem('banix_export_prefs');
      if (raw) {
        const prefs = JSON.parse(raw);
        if (prefs.filenamePattern) filenamePattern = prefs.filenamePattern;
        if (prefs.exportFormat) format = prefs.exportFormat;
      }
    } catch {}
    downloadAsYouTubePNG(imageUrl, mode, { filenamePattern, format, presetId });
  }

  return (
    <>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl shadow-black/20">
        {/* Top accent line */}
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-700/50 to-transparent" />

        <div className="p-4 sm:p-5 flex flex-col gap-4">
          {/* Preview area */}
          <div className={`${containerClass} relative rounded-xl overflow-hidden bg-zinc-800 border border-zinc-700/50`}>

            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900/80 backdrop-blur-sm z-10">
                <div className="relative w-12 h-12">
                  <div className="absolute inset-0 rounded-full border-2 border-zinc-700" />
                  <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-red-500 animate-spin" />
                </div>
                <p className="text-xs text-zinc-400 font-medium">Generating image…</p>
              </div>
            )}

            {/* Empty state */}
            {!isLoading && !imageUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6">
                <div className="w-14 h-14 rounded-2xl bg-zinc-800/80 border border-zinc-700/60 flex items-center justify-center">
                  <svg className="w-7 h-7 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                  </svg>
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-zinc-500">No image yet</p>
                  <p className="text-xs text-zinc-600 mt-0.5">Configure your settings and click Generate</p>
                </div>
              </div>
            )}

            {/* Generated image */}
            {imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Generated YouTube image"
                className="w-full h-full object-cover"
              />
            )}

            {imageUrl && isBanner && showSafeZone && <SafeZoneOverlay />}
          </div>

          {/* Action bar */}
          {imageUrl && (
            <div className="flex items-center gap-2 flex-wrap pt-1">
              {isBanner && (
                <button
                  onClick={() => setShowSafeZone((v) => !v)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 hover:border-zinc-600 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round"
                      d={showSafeZone
                        ? 'M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21'
                        : 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z'}
                    />
                  </svg>
                  {showSafeZone ? 'Hide safe zone' : 'Show safe zone'}
                </button>
              )}

              {/* Crop button */}
              <button
                onClick={() => setCropOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/60 hover:border-zinc-600 transition-all"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 3.75H6A2.25 2.25 0 003.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0120.25 6v1.5m0 9V18A2.25 2.25 0 0118 20.25h-1.5m-9 0H6A2.25 2.25 0 013.75 18v-1.5M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Crop &amp; Position
              </button>

              <button
                onClick={handleDownload}
                aria-label={`Download ${mode === 'banner' ? '2048×1152 banner' : '800×800 profile picture'}`}
                className="ml-auto flex items-center gap-2 px-4 py-1.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm shadow-red-900/30"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download {mode === 'banner' ? '2048×1152' : '800×800'}
              </button>
            </div>
          )}

          {/* Spec info when no image */}
          {!imageUrl && !isLoading && (
            <p className="text-[11px] text-zinc-600 text-center font-mono">
              Output: {mode === 'banner' ? '2048 × 1152 px · 16:9' : '800 × 800 px · 1:1'}
            </p>
          )}
        </div>
      </div>

      {/* Crop editor — full screen overlay */}
      {cropOpen && imageUrl && (
        <CropEditor
          imageUrl={imageUrl}
          mode={mode}
          onClose={() => setCropOpen(false)}
        />
      )}
    </>
  );
}
