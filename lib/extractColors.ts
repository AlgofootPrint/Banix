/**
 * Extracts dominant color names from an image file using a canvas.
 * Samples a grid of pixels, clusters them into rough hue buckets,
 * and returns the top color names (e.g. "deep blue, warm orange, dark green").
 */
export function extractDominantColors(file: File): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const SIZE = 64; // downsample to 64×64 for speed
      const canvas = document.createElement('canvas');
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, SIZE, SIZE);
      URL.revokeObjectURL(url);

      const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
      const buckets: Record<string, number> = {};

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const name = rgbToColorName(r, g, b);
        buckets[name] = (buckets[name] ?? 0) + 1;
      }

      const top = Object.entries(buckets)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name]) => name);

      resolve(top.join(', '));
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('');
    };

    img.src = url;
  });
}

function rgbToColorName(r: number, g: number, b: number): string {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2 / 255;
  const saturation = max === min ? 0 : (max - min) / 255;

  if (lightness < 0.15) return 'dark black';
  if (lightness > 0.88 && saturation < 0.12) return 'bright white';
  if (saturation < 0.12) return lightness < 0.5 ? 'dark grey' : 'light grey';

  // Hue
  const rc = (max - r) / (max - min);
  const gc = (max - g) / (max - min);
  const bc = (max - b) / (max - min);
  let hue = 0;
  if (r === max) hue = bc - gc;
  else if (g === max) hue = 2 + rc - bc;
  else hue = 4 + gc - rc;
  hue = ((hue / 6) % 1 + 1) % 1; // 0–1

  const brightness = lightness > 0.6 ? 'bright' : lightness < 0.35 ? 'dark' : 'vivid';

  if (hue < 0.05 || hue >= 0.95) return `${brightness} red`;
  if (hue < 0.10) return `${brightness} orange red`;
  if (hue < 0.17) return `${brightness} orange`;
  if (hue < 0.22) return `${brightness} golden yellow`;
  if (hue < 0.30) return `${brightness} yellow`;
  if (hue < 0.42) return `${brightness} green`;
  if (hue < 0.52) return `${brightness} teal`;
  if (hue < 0.62) return `${brightness} blue`;
  if (hue < 0.72) return `${brightness} deep blue`;
  if (hue < 0.80) return `${brightness} purple`;
  if (hue < 0.88) return `${brightness} magenta`;
  return `${brightness} pink`;
}
