'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface Props {
  sourceImage: string;
  onMaskChange: (maskDataUrl: string | null) => void;
}

const BRUSH_SIZES = [8, 16, 28, 44];

export default function InpaintCanvas({ sourceImage, onMaskChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [brushSize, setBrushSize] = useState(1); // index into BRUSH_SIZES
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  // Natural image dimensions
  const imgNatural = useRef<{ w: number; h: number }>({ w: 1, h: 1 });

  // Initialise canvas with source image dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const img = new Image();
    img.onload = () => {
      imgNatural.current = { w: img.naturalWidth, h: img.naturalHeight };
      // Canvas draws at natural size; CSS shrinks it
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      // Start with a fully black mask (nothing selected)
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      setHasMask(false);
      onMaskChange(null);
    };
    img.src = sourceImage;
  }, [sourceImage, onMaskChange]);

  // Convert mouse/touch position to canvas coordinates
  function toCanvasPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  function drawStroke(x: number, y: number) {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const radius = BRUSH_SIZES[brushSize];

    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = 'white';
    ctx.beginPath();

    if (lastPos.current) {
      // Interpolate between last and current pos for smooth lines
      const dx = x - lastPos.current.x;
      const dy = y - lastPos.current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const steps = Math.max(1, Math.floor(dist / (radius / 2)));
      for (let i = 0; i <= steps; i++) {
        const px = lastPos.current.x + (dx * i) / steps;
        const py = lastPos.current.y + (dy * i) / steps;
        ctx.moveTo(px, py);
        ctx.arc(px, py, radius, 0, Math.PI * 2);
      }
    } else {
      ctx.arc(x, y, radius, 0, Math.PI * 2);
    }

    ctx.fill();
    lastPos.current = { x, y };
  }

  function exportMask() {
    const canvas = canvasRef.current!;
    onMaskChange(canvas.toDataURL('image/png'));
    setHasMask(true);
  }

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = null;
    const pos = toCanvasPos(e);
    drawStroke(pos.x, pos.y);
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = toCanvasPos(e);
    drawStroke(pos.x, pos.y);
    exportMask();
  }

  function handleMouseUp() {
    setIsDrawing(false);
    lastPos.current = null;
    exportMask();
  }

  function handleTouchStart(e: React.TouchEvent) {
    e.preventDefault();
    setIsDrawing(true);
    lastPos.current = null;
    const pos = toCanvasPos(e);
    drawStroke(pos.x, pos.y);
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!isDrawing) return;
    e.preventDefault();
    const pos = toCanvasPos(e);
    drawStroke(pos.x, pos.y);
    exportMask();
  }

  function handleTouchEnd() {
    setIsDrawing(false);
    lastPos.current = null;
    exportMask();
  }

  const clearMask = useCallback(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasMask(false);
    onMaskChange(null);
  }, [onMaskChange]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest">
          Paint Mask <span className="text-zinc-600 normal-case tracking-normal">(white = repaint)</span>
        </p>
        {hasMask && (
          <button
            onClick={clearMask}
            className="text-[10px] text-zinc-500 hover:text-red-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Image + canvas overlay */}
      <div ref={containerRef} className="relative rounded-xl overflow-hidden border border-zinc-700 select-none">
        {/* Source image underneath */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={sourceImage}
          alt="Source"
          className="w-full block"
          draggable={false}
        />

        {/* Mask canvas overlay */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ opacity: 0.55, cursor: 'crosshair', touchAction: 'none' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        />
      </div>

      {/* Brush size selector */}
      <div className="flex items-center gap-2 mt-2.5">
        <span className="text-[10px] text-zinc-600">Brush</span>
        <div className="flex gap-1.5">
          {BRUSH_SIZES.map((size, i) => (
            <button
              key={i}
              onClick={() => setBrushSize(i)}
              className="rounded-full transition-all border flex items-center justify-center"
              style={{
                width: 24,
                height: 24,
                borderColor: brushSize === i ? 'rgba(220,38,38,0.6)' : 'rgb(63,63,70)',
                background: brushSize === i ? 'rgba(220,38,38,0.1)' : 'transparent',
              }}
              title={`${size}px`}
            >
              <div
                className="rounded-full bg-zinc-400"
                style={{ width: Math.max(3, size / 5), height: Math.max(3, size / 5) }}
              />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
