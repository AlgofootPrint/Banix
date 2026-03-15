import { ImageMode, YOUTUBE_DIMS } from './types';

interface DownloadOptions {
  filenamePattern?: string;
  format?: 'png' | 'webp';
  presetId?: string | null;
}

export async function downloadAsYouTubePNG(
  imageUrl: string,
  mode: ImageMode,
  options?: DownloadOptions
): Promise<void> {
  const dims = YOUTUBE_DIMS[mode];

  const pattern = options?.filenamePattern ?? 'banix-{date}-{mode}';
  const date = new Date().toISOString().slice(0, 10);
  const preset = options?.presetId ?? '';
  const ext = options?.format === 'webp' ? 'webp' : 'png';
  const mimeType = options?.format === 'webp' ? 'image/webp' : 'image/png';
  const filename =
    pattern
      .replace('{date}', date)
      .replace('{mode}', mode)
      .replace('{preset}', preset) +
    `.${ext}`;

  const img = await loadImage(imageUrl);

  const canvas = document.createElement('canvas');
  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext('2d')!;

  const imgAspect = img.naturalWidth / img.naturalHeight;
  const canvasAspect = dims.width / dims.height;

  let drawWidth: number;
  let drawHeight: number;
  let offsetX = 0;
  let offsetY = 0;

  if (imgAspect > canvasAspect) {
    drawHeight = dims.height;
    drawWidth = drawHeight * imgAspect;
    offsetX = (dims.width - drawWidth) / 2;
  } else {
    drawWidth = dims.width;
    drawHeight = drawWidth / imgAspect;
    offsetY = (dims.height - drawHeight) / 2;
  }

  ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, mimeType);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
