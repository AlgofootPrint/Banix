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
  }, []);

  useEffect(() => {
    const img  = new Image();
    img.onload = () => { imgRef.current = img; setImgLoaded(true); };
    img.src    = imageUrl;
  }, [imageUrl]);

  useEffect(() => { if (imgLoaded) initScale(); }, [imgLoaded, initScale]);

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

  // ── Unified mouse/touch handlers ──────────────────────────────────────────
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

  // Mouse
  function onMouseDown(e: React.MouseEvent) { startDrag('image', e.clientX, e.clientY); }
  function onMouseMove(e: React.MouseEvent) { if (dragTarget.current) moveDrag(e.clientX, e.clientY); }
  function onMouseUp()                      { endDrag(); }

  function onSafeMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    startDrag('safezone', e.clientX, e.clientY);
  }

  // Touch
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

  // Scroll zoom
  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const factor   = e.deltaY < 0 ? 1.08 : 0.93;
    const newScale = Math.min(4, Math.max(minScale * 0.5, scale * factor));
    const { px, py } = clampPan(panX, panY, newScale);
    setScale(newScale); setPanX(px); setPanY(py);
  }

  // ── Download ──────────────────────────────────────────────────────────────
  // Strategy: find what source pixel sits under the safe zone centre, then
  // position the image in the output so that pixel lands exactly at the
  // output canvas centre (= the safe zone centre in the 2048×1152 spec).
  // The surrounding image fills the rest of the canvas naturally.
  async function handleDownload() {
    const vp  = viewportRef.current;
    const img = imgRef.current;
    if (!vp || !img) return;
    setDownloading(true);
    setDownloadError(false);

    const displayW = vp.clientWidth;
    const displayH = vp.clientHeight;

    // Output pixels per source pixel
    const S = (CANVAS_W * scale) / displayW;

    // Image top-left in display space
    const imgLeft = displayW / 2 - img.naturalWidth  * scale / 2 + panX;
    const imgTop  = displayH / 2 - img.naturalHeight * scale / 2 + panY;

    // Source pixel under the safe zone box centre
    const safeCenterX_display = displayW / 2 + safeOffX;
    const safeCenterY_display = displayH / 2 + safeOffY;
    const srcCenterX = (safeCenterX_display - imgLeft) / scale;
    const srcCenterY = (safeCenterY_display - imgTop)  / scale;

    // Position image in output so that source centre → output centre (1024, 576)
    const outImgLeft = CANVAS_W / 2 - srcCenterX * S;
    const outImgTop  = CANVAS_H / 2 - srcCenterY * S;

    const dims   = YOUTUBE_DIMS[mode];
    const canvas = document.createElement('canvas');
    canvas.width  = dims.width;
    canvas.height = dims.height;
    const ctx = canvas.getContext('2d')!;

    const outImgW = img.naturalWidth  * S;
    const outImgH = img.naturalHeight * S;

    // ── Layer 1: cover-fill base (extreme blur, ensures zero gaps) ────────
    const coverScale = Math.max(dims.width / img.naturalWidth, dims.height / img.naturalHeight) * 1.1;
    ctx.filter = 'blur(72px) saturate(1.4)';
    ctx.drawImage(
      img,
      (dims.width  - img.naturalWidth  * coverScale) / 2,
      (dims.height - img.naturalHeight * coverScale) / 2,
      img.naturalWidth  * coverScale,
      img.naturalHeight * coverScale,
    );

    // ── Layer 2: same image at exact crop position, blurred + scaled out ──
    // Drawn at the same spot as the sharp image but 20% larger so the blur
    // bleeds from the real edge pixels — creates a seamless dissolve.
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

    // ── Layer 3: sharp image at crop position ─────────────────────────────
    ctx.drawImage(img, outImgLeft, outImgTop, outImgW, outImgH);

    try {
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
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950 shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
          </button>
          <div>
            <h2 className="text-white text-sm font-semibold">Crop &amp; Position</h2>
            <p className="text-zinc-500 text-xs hidden sm:block">
              Drag image to pan · Scroll to zoom · <span className="text-red-400">Drag red box</span> to reposition safe zone
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => { const s = Math.max(minScale * 0.5, scale * 0.85); const { px, py } = clampPan(panX, panY, s); setScale(s); setPanX(px); setPanY(py); }}
            className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-lg leading-none"
          >−</button>
          <span className="text-xs text-zinc-500 w-12 text-center tabular-nums">
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

          {downloadError && (
            <span className="text-xs text-red-400">Download failed — try again</span>
          )}
          <button
            onClick={handleDownload}
            disabled={downloading || !imgLoaded}
            aria-label={`Download cropped ${mode === 'banner' ? '2048×1152 banner' : '800×800 profile picture'}`}
            className="flex items-center gap-2 px-4 h-8 rounded-lg text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{ background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)' }}
          >
            {downloading ? (
              <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            Download {mode === 'banner' ? '2048×1152' : '800×800'}
          </button>
        </div>
      </div>

      {/* Viewport */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-8">
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
          {/* Layer 1: extreme-blur cover fill — guarantees no gaps */}
          {imgLoaded && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageUrl}
              alt=""
              draggable={false}
              aria-hidden
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              style={{ filter: 'blur(40px) saturate(1.4)', transform: 'scale(1.1)' }}
            />
          )}

          {/* Layer 2: same pan/zoom as real image but blurred + scaled out
              Bleeds from the real edge pixels → seamless dissolve */}
          {imgLoaded && (
            // eslint-disable-next-line @next/next/no-img-element
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
          )}

          {/* Layer 3: sharp image */}
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

          {/* Vignette outside safe zone — 4 panels that follow the safe box */}
          {isBanner && imgLoaded && (
            <>
              {/* Top */}
              <div className="absolute left-0 right-0 top-0 bg-black/45 pointer-events-none"
                style={{ height: safeRect.top }} />
              {/* Bottom */}
              <div className="absolute left-0 right-0 bottom-0 bg-black/45 pointer-events-none"
                style={{ top: safeRect.top + safeRect.height }} />
              {/* Left */}
              <div className="absolute left-0 bg-black/45 pointer-events-none"
                style={{ top: safeRect.top, height: safeRect.height, width: safeRect.left }} />
              {/* Right */}
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
              {/* Red border */}
              <div className="absolute inset-0 ring-2 ring-red-500 rounded-sm" />

              {/* Corner handles */}
              {[['top-0 left-0', '-translate-x-1/2 -translate-y-1/2'],
                ['top-0 right-0', 'translate-x-1/2 -translate-y-1/2'],
                ['bottom-0 left-0', '-translate-x-1/2 translate-y-1/2'],
                ['bottom-0 right-0', 'translate-x-1/2 translate-y-1/2']].map(([pos, trans], i) => (
                <div key={i}
                  className={`absolute ${pos} w-3 h-3 bg-red-500 rounded-sm transform ${trans}`}
                />
              ))}

              {/* Label */}
              <span className="absolute -top-5 left-0 text-[10px] text-red-400 font-mono whitespace-nowrap select-none">
                Safe zone — 1546 × 423
              </span>

              {/* Move icon in centre */}
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
        </div>
      </div>

      {/* Footer */}
      <div className="text-center pb-4 text-[11px] text-zinc-600 px-4">
        <span className="text-red-400/70">Red box</span> = YouTube safe zone (visible on all devices) ·
        Drag the <span className="text-red-400/70">red box</span> to reposition it · Drag the image to pan
      </div>
    </div>
  );
}
