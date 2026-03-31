export type ImageMode = 'banner' | 'pfp';
export type AIMode = 'text2img' | 'img2img';

export interface StylePreset {
  id: string;
  label: string;
  icon: string;
  promptSnippet: string;
  gradient: string;
}

export interface GenerateRequest {
  prompt: string;
  mode: ImageMode;
  presetId: string | null;
}

export interface GenerateResponse {
  error?: string;
  rateLimited?: boolean;
  modelLoading?: boolean;
  retryAfterSeconds?: number;
}

export const YOUTUBE_DIMS = {
  banner: { width: 2048, height: 1152 },
  pfp: { width: 800, height: 800 },
} as const;

export const HF_DIMS = {
  banner: { width: 1024, height: 576 },
  pfp: { width: 512, height: 512 },
} as const;

// Safe zone: centered 1546×423 within 2048×1152
export const SAFE_ZONE = {
  x: (2048 - 1546) / 2,   // 251
  y: (1152 - 423) / 2,    // 364.5
  width: 1546,
  height: 423,
} as const;
