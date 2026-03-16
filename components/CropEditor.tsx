'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImageMode, YOUTUBE_DIMS } from '@/lib/types';

interface Props {
  imageUrl: string;
  mode: ImageMode;
  onClose: () => void;
}

const SAFE_W  = 1546;
const SAFE_H  = 423;
const CANVAS_W = 2048;
const CANVAS_H = 1152;

type DragTarget = 'image' | 'safezone' | null;

// Dimensions sent to Fal.ai for outpainting (must match generation dims)
const OUT_DIMS: Record<ImageMode, { w: number; h: number }> = {
  banner: { w: 1024, h: 576 },
  pfp:    { w: 512,  h: 512  },
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function CropEditor({ imageUrl, mode, onClose }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const imgRef      = useRef<HTMLImageElement | null>(null);

  const [panX, setPanX]         = useState(0);
  const [panY, setPanY]         = useState(0);
  const [scale, setScale]       = useState(1);
  const [minScale, setMinScale] = useState(1);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  // Safe zone moveable offset (pixels in display space, from viewport centre)
  const [safeOffX, setSafeOffX] = useState(0);
  const [safeOffY, setSafeOffY] = useState(0);

  // AI fill state
  const [aiFillUrl, setAiFillUrl]           = useState<string | null>(null);
  const [isGeneratingFill, setIsGeneratingFill] = useState(false);
  const [fillError, setFillError]           = useState<string | null>(null);
  const [fillSnapshot, setFillSnapshot]     = useState<{ panX: number; panY: number; scale: number } | null>(null);
  const aiFillBlobRef = useRef<string | null>(null);

  const dragTarget = useRef<DragTarget>(null);
  const dragStart  = useRef({ clientX: 0, clientY: 0, startPanX: 0, startPanY: 0, startSafeX: 0, startSafeY: 0 });

  const isBanner = mode === 'banner';

  // ── Init ──────────────────────────────────────────────────────────────────
  const initScale = useCallback(() => {
    const vp  = viewportRef.current;
    const img = imgRef.current;
    if (!vp || !img || !img.naturalWidth) return;
    const fit = Math.max(vp.clientWidth / img.naturalWidth, vp.clientHeight / img.naturalHeight);
    setMinScale(fit);
    setScale(fit);
    setPanX(0);
    setPanY(0);
    setSafeOffX(0);
    setSafeOffY(0);
    setAiFillUrl(null);
    setFillSnapshot(null);
    setFillError(null);
  }, []);

  useEffect(() => {
    const img  = new Image();
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.src    = imageUrl;
  }, [imageUrl]);

  useEffect(() => { if (imgLoaded) initScale(); }, [imgLoaded, initScale]);

  // Revoke old fill blob URL on change
  useEffect(() => {
    return () => {
      if (aiFillBlobRef.current) URL.revokeObjectURL(aiFillBlobRef.current);
    };
  }, []);

  // ── Clamp helpers ─────────────────────────────────────────────────────────
  function clampPan(px: number, py: number, sc: number) {
    const vp  = viewportRef.current;
    const img = imgRef.current;
    if (!vp || !img) return { px, py };
    const halfExtraX = Math.max(0, (img.naturalWidth  * sc - vp.clientWidth)  / 2);
    const halfExtraY = Math.max(0, (img.naturalHeight * sc - vp.clientHeight) / 2);
    return {
      px: Math.min(halfExtraX, Math.max(-halfExtraX, px)),
      py: Math.min(halfExtraY, Math.max(-halfExtraY, py)),
    };
  }

  function clampSafe(sx: number, sy: number) {
    const vp = viewportRef.current;
    if (!vp) return { sx, sy };
    const scaleX = vp.clientWidth  / CANVAS_W;
    const scaleY = vp.clientHeight / CANVAS_H;
    const sw = SAFE_W * scaleX;
    const sh = SAFE_H * scaleY;
    const maxX = (vp.clientWidth  - sw) / 2;
    const maxY = (vp.clientHeight - sh) / 2;
    return {
      sx: Math.min(maxX, Math.max(-maxX, sx)),
      sy: Math.min(maxY, Math.max(-maxY, sy)),
    };
  }

  // ── Drag handlers ─────────────────────────────────────────────────────────
  function startDrag(target: DragTarget, clientX: number, clientY: number) {
    dragTarget.current = target;
    dragStart.current  = { clientX, clientY, startPanX: panX, startPanY: panY, startSafeX: safeOffX, startSafeY: safeOffY };
  }

  function moveDrag(clientX: number, clientY: number) {
    const dx = clientX - dragStart.current.clientX;
    const dy = clientY - dragStart.current.clientY;
    if (dragTarget.current === 'image') {
      const { px, py } = clampPan(dragStart.current.startPanX + dx, dragStart.current.startPanY + dy, scale);
      setPanX(px); setPanY(py);
    } else if (dragTarget.current === 'safezone') {
      const { sx, sy } = clampSafe(dragStart.current.startSafeX + dx, dragStart.current.startSafeY + dy);
      setSafeOffX(sx); setSafeOffY(sy);
    }
  }

  function endDrag() { dragTarget.current = null; }

  function onMouseDown(e: React.MouseEvent) { startDrag('image', e.clientX, e.clientY); }
  function onMouseMove(e: React.MouseEvent) { if (dragTarget.current) moveDrag(e.clientX, e.clientY); }
  function onMouseUp()                      { endDrag(); }

  function onSafeMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    startDrag('safezone', e.clientX, e.clientY);
  }

  const lastTouch = useRef<{ x: number; y: number } | null>(null);

  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 1) {
      lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      startDrag('image', e.touches[0].clientX, e.touches[0].clientY);
    }
  }

  function onSafeTouchStart(e: React.TouchEvent) {
    e.stopPropagation();
    if (e.touches.length === 1) startDrag('safezone', e.touches[0].clientX, e.touches[0].clientY);
  }

  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 1) moveDrag(e.touches[0].clientX, e.touches[0].clientY);
  }

  function onTouchEnd() { endDrag(); lastTouch.current = null; }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor   = e.deltaY < 0 ? 1.08 : 0.93;
    const newScale = Math.min(4, Math.max(0.01, scale * factor));
    const { px, py } = clampPan(panX, panY, newScale);
    setScale(newScale); setPanX(px); setPanY(py);
  }

  // ── AI Fill ───────────────────────────────────────────────────────────────
  async function generateAIFill() {
    const vp  = viewportRef.current;
    const img = imgRef.current;
    if (!vp || !img) return;

    setIsGeneratingFill(true);
    setFillError(null);

    const { w: outW, h: outH } = OUT_DIMS[mode];

    // Scale factor: display pixels → canvas pixels
    const d2c = outW / vp.clientWidth;

    const scaledImgW = img.naturalWidth  * scale * d2c;
    const scaledImgH = img.naturalHeight * scale * d2c;
    const imgLeft    = outW / 2 - scaledImgW / 2 + panX * d2c;
    const imgTop     = outH / 2 - scaledImgH / 2 + panY * d2c;

    // ── Composite canvas ──────────────────────────────────────────────────
    // Background: blurred cover-fill of source image so the model has colour/tone
    // context to extend from. Sharp source is drawn on top at its crop position.
    const composite = document.createElement('canvas');
    composite.width  = outW;
    composite.height = outH;
    const cCtx = composite.getContext('2d')!;

    const coverScale = Math.max(outW / img.naturalWidth, outH / img.naturalHeight);
    cCtx.filter = 'blur(24px) saturate(1.1)';
    cCtx.drawImage(
      img,
      (outW - img.naturalWidth  * coverScale) / 2,
      (outH - img.naturalHeight * coverScale) / 2,
      img.naturalWidth  * coverScale,
      img.naturalHeight * coverScale,
    );
    cCtx.filter = 'none';
    cCtx.drawImage(img, imgLeft, imgTop, scaledImgW, scaledImgH);

    // ── Mask canvas: white = fill, black = preserve ────────────────────────
    const mask = document.createElement('canvas');
    mask.width  = outW;
    mask.height = outH;
    const mCtx = mask.getContext('2d')!;
    mCtx.fillStyle = 'white';
    mCtx.fillRect(0, 0, outW, outH);

    // Black over the clamped area where source image sits
    const cL = Math.max(0, imgLeft);
    const cT = Math.max(0, imgTop);
    const cR = Math.min(outW, imgLeft + scaledImgW);
    const cB = Math.min(outH, imgTop  + scaledImgH);
    if (cR > cL && cB > cT) {
      mCtx.fillStyle = 'black';
      mCtx.fillRect(cL, cT, cR - cL, cB - cT);
    }

    const compositeDataUrl = composite.toDataURL('image/png');
    const maskDataUrl      = mask.toDataURL('image/png');

    try {
      const res = await fetch('/api/outpaint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ compositeImage: compositeDataUrl, maskImage: maskDataUrl }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Fill failed');
      }

      const blob = await res.blob();

      // Revoke previous fill URL
      if (aiFillBlobRef.current) URL.revokeObjectURL(aiFillBlobRef.current);
      const url = URL.createObjectURL(blob);
      aiFillBlobRef.current = url;
      setAiFillUrl(url);
      setFillSnapshot({ panX, panY, scale });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Fill generation failed';
      setFillError(msg);
    } finally {
      setIsGeneratingFill(false);
    }
  }

  // Detect if position has drifted from where fill was generated
  const fillIsStale = fillSnapshot !== null && (
    Math.abs(panX - fillSnapshot.panX) > 8 ||
    Math.abs(panY - fillSnapshot.panY) > 8 ||
    Math.abs(scale - fillSnapshot.scale) / fillSnapshot.scale > 0.03
  );

  // ── Download ──────────────────────────────────────────────────────────────
  async function handleDownload() {
    const vp  = viewportRef.current;
    const img = imgRef.current;
    if (!vp || !img) return;
    setDownloading(true);
    setDownloadError(false);

    const displayW = vp.clientWidth;
    const displayH = vp.clientHeight;

    const S = (CANVAS_W * scale) / displayW;

    const imgLeft = displayW / 2 - img.naturalWidth  * scale / 2 + panX;
    const imgTop  = displayH / 2 - img.naturalHeight * scale / 2 + panY;

    const safeCenterX_display = displayW / 2 + safeOffX;
    const safeCenterY_display = displayH / 2 + safeOffY;
    const srcCenterX = (safeCenterX_display - imgLeft) / scale;
    const srcCenterY = (safeCenterY_display - imgTop)  / scale;

    const outImgLeft = CANVAS_W / 2 - srcCenterX * S;
    const outImgTop  = CANVAS_H / 2 - srcCenterY * S;

    const dims   = YOUTUBE_DIMS[mode];
    const canvas = document.createElement('canvas');
    canvas.width  = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext('2d')!;

    const outImgW = img.naturalWidth  * S;
    const outImgH = img.naturalHeight * S;

    try {
      if (aiFillUrl) {
        // ── Layer 1: AI-generated fill scaled to output ────────────────────
        const aiFillImg = await loadImage(aiFillUrl);
        ctx.drawImage(aiFillImg, 0, 0, dims.width, dims.height);
      } else {
        // ── Layer 1: extreme-blur cover fill ──────────────────────────────
        const coverScale = Math.max(dims.width / img.naturalWidth, dims.height / img.naturalHeight) * 1.1;
        ctx.filter = 'blur(72px) saturate(1.4)';
        ctx.drawImage(
          img,
          (dims.width  - img.naturalWidth  * coverScale) / 2,
          (dims.height - img.naturalHeight * coverScale) / 2,
          img.naturalWidth  * coverScale,
          img.naturalHeight * coverScale,
        );

        // ── Layer 2: blurred bleed from real edge pixels ──────────────────
        const bleed = 1.2;
        ctx.filter = 'blur(28px) saturate(1.15)';
        ctx.drawImage(
          img,
          outImgLeft - (outImgW * (bleed - 1)) / 2,
          outImgTop  - (outImgH * (bleed - 1)) / 2,
          outImgW * bleed,
          outImgH * bleed,
        );
        ctx.filter = 'none';
      }

      // ── Final layer: sharp source image at crop position ─────────────────
      ctx.filter = 'none';
      ctx.drawImage(img, outImgLeft, outImgTop, outImgW, outImgH);

      canvas.toBlob((blob) => {
        if (!blob) { setDownloading(false); setDownloadError(true); return; }
        const url = URL.createObjectURL(blob);
        const a   = document.createElement('a');
        a.href    = url;
        a.download = mode === 'banner' ? 'youtube-banner-cropped.png' : 'youtube-profile-cropped.png';
        a.click();
        URL.revokeObjectURL(url);
        setDownloading(false);
      }, 'image/png');
    } catch {
      setDownloading(false);
      setDownloadError(true);
    }
  }

  // ── Safe zone geometry ────────────────────────────────────────────────────
  function getSafeRect() {
    const vp = viewportRef.current;
    if (!vp) return { left: 0, top: 0, width: 0, height: 0 };
    const scaleX = vp.clientWidth  / CANVAS_W;
    const scaleY = vp.clientHeight / CANVAS_H;
    const sw = SAFE_W * scaleX;
    const sh = SAFE_H * scaleY;
    return {
      left:   (vp.clientWidth  - sw) / 2 + safeOffX,
      top:    (vp.clientHeight - sh) / 2 + safeOffY,
      width:  sw,
      height: sh,
    };
  }

  const imgTransform   = `translate(${panX}px, ${panY}px) scale(${scale})`;
  const safeRect       = getSafeRect();
  const isDraggingSafe = dragTarget.current === 'safezone';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-sm flex flex-col">

      {/* Header — row 1: back + title + download (always visible) */}
      <div className="border-b border-zinc-800 bg-zinc-950 shrink-0">
        <div className="flex items-center gap-2 px-3 py-2.5">
          {/* Back button — always leftmost, never hidden */}
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            aria-label="Back"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <h2 className="text-white text-sm font-semibold leading-tight">Crop &amp; Position</h2>
            <p className="text-zinc-500 text-[11px] hidden sm:block truncate">
              Drag to pan · Pinch/scroll to zoom · <span className="text-red-400">Drag red box</span> to move safe zone
            </p>
          </div>

          {/* Download — always rightmost */}
          <div className="flex items-center gap-1.5 shrink-0">
            {downloadError && (
              <span className="text-[10px] text-red-400 hidden sm:block">Failed</span>
            )}
            <button
              onClick={handleDownload}
              disabled={downloading || !imgLoaded}
              aria-label={`Download ${mode === 'banner' ? '2048×1152' : '800×800'}`}
              className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }}
            >
              {downloading ? (
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
              )}
              <span className="hidden sm:inline">Download </span>
              {mode === 'banner' ? '2048×1152' : '800×800'}
            </button>
          </div>
        </div>

        {/* Header — row 2: zoom + reset + AI fill */}
        <div className="flex items-center gap-2 px-3 pb-2.5 flex-wrap">
          {/* Zoom controls */}
          <button
            onClick={() => { const s = Math.max(0.01, scale * 0.85); const { px, py } = clampPan(panX, panY, s); setScale(s); setPanX(px); setPanY(py); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-lg leading-none"
          >−</button>
          <span className="text-xs text-zinc-500 w-11 text-center tabular-nums">
            {Math.round((scale / minScale) * 100)}%
          </span>
          <button
            onClick={() => { const s = Math.min(4, scale * 1.15); const { px, py } = clampPan(panX, panY, s); setScale(s); setPanX(px); setPanY(py); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-lg leading-none"
          >+</button>
          <button
            onClick={initScale}
            className="px-3 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white text-xs transition-colors"
          >
            Reset
          </button>

          <div className="w-px h-5 bg-zinc-700" />

          {/* AI Fill */}
          {fillError && (
            <span className="text-[10px] text-red-400 truncate max-w-[120px]">{fillError}</span>
          )}
          {aiFillUrl && fillIsStale && !isGeneratingFill && (
            <span className="text-[10px] text-yellow-500/80">Stale</span>
          )}
          <button
            onClick={generateAIFill}
            disabled={isGeneratingFill || !imgLoaded}
            title="Generate AI context fill for empty areas"
            className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-xs font-medium transition-all disabled:cursor-not-allowed disabled:opacity-50 border"
            style={{
              background:   aiFillUrl && !fillIsStale ? 'rgba(34,197,94,0.12)' : isGeneratingFill ? 'rgb(39,39,42)' : 'rgba(220,38,38,0.12)',
              borderColor:  aiFillUrl && !fillIsStale ? 'rgba(34,197,94,0.4)'  : isGeneratingFill ? 'rgb(63,63,70)'  : 'rgba(220,38,38,0.4)',
              color:        aiFillUrl && !fillIsStale ? '#4ade80'               : isGeneratingFill ? '#71717a'        : '#f87171',
            }}
          >
            {isGeneratingFill ? (
              <>
                <span className="w-3 h-3 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
                <span className="hidden sm:inline">Generating…</span>
              </>
            ) : aiFillUrl && !fillIsStale ? (
              <>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
                <span className="hidden sm:inline">AI Fill active</span>
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                </svg>
                {fillIsStale ? 'Regen Fill' : 'AI Fill'}
              </>
            )}
          </button>
        </div>
      </div>

      {/* Viewport */}
      <div className="flex-1 flex items-center justify-center p-2 sm:p-6">
        <div
          ref={viewportRef}
          className={`relative overflow-hidden bg-zinc-900 border border-zinc-700 rounded-xl select-none ${
            isBanner ? 'w-full max-w-4xl aspect-[16/9]' : 'w-80 h-80 sm:w-96 sm:h-96'
          }`}
          style={{ cursor: dragTarget.current === 'image' ? 'grabbing' : 'grab' }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onWheel={onWheel}
        >
          {/* ── Background fill layer ─────────────────────────────────── */}
          {imgLoaded && aiFillUrl ? (
            // AI-generated fill
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={aiFillUrl}
              alt=""
              draggable={false}
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            />
          ) : imgLoaded ? (
            // Fallback: blur fill
            <>
              {/* Extreme-blur cover fill */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                draggable={false}
                aria-hidden
                className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                style={{ filter: 'blur(40px) saturate(1.4)', transform: 'scale(1.1)' }}
              />
              {/* Bleed from real edge pixels */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                draggable={false}
                aria-hidden
                className="absolute top-1/2 left-1/2 pointer-events-none"
                style={{
                  transform: `translate(-50%, -50%) ${imgTransform} scale(1.2)`,
                  transformOrigin: 'center center',
                  maxWidth: 'none',
                  filter: 'blur(18px) saturate(1.15)',
                }}
              />
            </>
          ) : null}

          {/* ── Sharp source image ────────────────────────────────────── */}
          {imgLoaded && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt="Crop preview"
              draggable={false}
              className="absolute top-1/2 left-1/2 pointer-events-none"
              style={{
                transform: `translate(-50%, -50%) ${imgTransform}`,
                transformOrigin: 'center center',
                maxWidth: 'none',
              }}
            />
          )}

          {/* Vignette outside safe zone */}
          {isBanner && imgLoaded && (
            <>
              <div className="absolute left-0 right-0 top-0 bg-black/45 pointer-events-none"
                style={{ height: safeRect.top }} />
              <div className="absolute left-0 right-0 bottom-0 bg-black/45 pointer-events-none"
                style={{ top: safeRect.top + safeRect.height }} />
              <div className="absolute left-0 bg-black/45 pointer-events-none"
                style={{ top: safeRect.top, height: safeRect.height, width: safeRect.left }} />
              <div className="absolute right-0 bg-black/45 pointer-events-none"
                style={{ top: safeRect.top, height: safeRect.height, left: safeRect.left + safeRect.width }} />
            </>
          )}

          {/* Safe zone box — draggable */}
          {isBanner && imgLoaded && (
            <div
              className="absolute"
              style={{
                left:   safeRect.left,
                top:    safeRect.top,
                width:  safeRect.width,
                height: safeRect.height,
                cursor: isDraggingSafe ? 'grabbing' : 'grab',
                zIndex: 10,
              }}
              onMouseDown={onSafeMouseDown}
              onTouchStart={onSafeTouchStart}
            >
              <div className="absolute inset-0 ring-2 ring-red-500 rounded-sm" />
              {[['top-0 left-0', '-translate-x-1/2 -translate-y-1/2'],
                ['top-0 right-0', 'translate-x-1/2 -translate-y-1/2'],
                ['bottom-0 left-0', '-translate-x-1/2 translate-y-1/2'],
                ['bottom-0 right-0', 'translate-x-1/2 translate-y-1/2']].map(([pos, trans], i) => (
                <div key={i}
                  className={`absolute ${pos} w-3 h-3 bg-red-500 rounded-sm transform ${trans}`}
                />
              ))}
              <span className="absolute -top-5 left-0 text-[10px] text-red-400 font-mono whitespace-nowrap select-none">
                Safe zone — 1546 × 423
              </span>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-30">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round"
                    d="M3.75 9h16.5m-16.5 6.75h16.5M9 3.75v16.5M15 3.75v16.5" />
                </svg>
              </div>
            </div>
          )}

          {/* PFP circle guide */}
          {!isBanner && imgLoaded && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="w-full h-full rounded-full ring-2 ring-red-500/60" />
            </div>
          )}

          {/* Spinner */}
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="w-8 h-8 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
            </div>
          )}

          {/* AI fill generating overlay */}
          {isGeneratingFill && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20 pointer-events-none">
              <div className="flex flex-col items-center gap-2">
                <span className="w-8 h-8 border-2 border-zinc-600 border-t-red-500 rounded-full animate-spin" />
                <span className="text-xs text-zinc-300">Generating context…</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-3 text-[10px] text-zinc-600 px-4 hidden sm:block">
        <span className="text-red-400/70">Red box</span> = YouTube safe zone ·
        Drag the <span className="text-red-400/70">red box</span> to reposition · Scale down + <span className="text-red-400/70">AI Fill</span> to extend
      </div>
    </div>
  );
}
