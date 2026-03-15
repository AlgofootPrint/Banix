'use client';

import { SAFE_ZONE } from '@/lib/types';

// SVG viewBox matches the YouTube spec exactly (2048×1152).
// width/height="100%" makes it fill the preview container at any size.
// Since the container is always 16:9 (matching 2048×1152), scaling is uniform.
export default function SafeZoneOverlay() {
  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none"
      viewBox="0 0 2048 1152"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <defs>
        <mask id="safe-zone-mask">
          <rect width="2048" height="1152" fill="white" />
          <rect
            x={SAFE_ZONE.x}
            y={SAFE_ZONE.y}
            width={SAFE_ZONE.width}
            height={SAFE_ZONE.height}
            fill="black"
          />
        </mask>
      </defs>

      {/* Dimmed area outside safe zone */}
      <rect
        width="2048"
        height="1152"
        fill="black"
        fillOpacity={0.45}
        mask="url(#safe-zone-mask)"
      />

      {/* Dashed border */}
      <rect
        x={SAFE_ZONE.x}
        y={SAFE_ZONE.y}
        width={SAFE_ZONE.width}
        height={SAFE_ZONE.height}
        fill="none"
        stroke="white"
        strokeWidth={3}
        strokeDasharray="20 13"
        strokeOpacity={0.8}
      />

      {/* Label */}
      <text
        x={SAFE_ZONE.x + SAFE_ZONE.width / 2}
        y={SAFE_ZONE.y - 12}
        textAnchor="middle"
        fill="white"
        fillOpacity={0.7}
        fontSize={24}
        fontFamily="system-ui, sans-serif"
      >
        Safe zone (visible on all devices)
      </text>
    </svg>
  );
}
