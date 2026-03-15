import { StylePreset } from './types';

export const PRESETS: StylePreset[] = [
  {
    id: 'gaming',
    label: 'Gaming',
    icon: 'gaming',
    promptSnippet: 'epic gaming setup, neon RGB lighting, dark futuristic background, dramatic cinematic lighting, ultra detailed',
    gradient: 'from-purple-900 to-blue-900',
  },
  {
    id: 'vlog',
    label: 'Vlog',
    icon: 'vlog',
    promptSnippet: 'bright cheerful lifestyle photography, warm golden hour lighting, vibrant colors, modern aesthetic',
    gradient: 'from-orange-400 to-pink-500',
  },
  {
    id: 'music',
    label: 'Music',
    icon: 'music',
    promptSnippet: 'music production studio, sound waves visualization, concert stage lighting, artistic abstract',
    gradient: 'from-pink-600 to-purple-700',
  },
  {
    id: 'tech',
    label: 'Tech',
    icon: 'tech',
    promptSnippet: 'sleek technology background, circuit board patterns, blue digital interface, clean professional look',
    gradient: 'from-cyan-600 to-blue-700',
  },
  {
    id: 'minimalist',
    label: 'Minimalist',
    icon: 'minimalist',
    promptSnippet: 'clean minimalist design, simple geometric shapes, soft pastel colors, elegant whitespace, modern typography',
    gradient: 'from-gray-200 to-slate-300',
  },
  {
    id: 'dark',
    label: 'Dark',
    icon: 'dark',
    promptSnippet: 'dark moody atmosphere, deep shadows, dramatic contrast, cinematic noir style, mysterious aesthetic',
    gradient: 'from-gray-900 to-zinc-800',
  },
  {
    id: 'neon',
    label: 'Neon',
    icon: 'neon',
    promptSnippet: 'neon cyberpunk city, glowing neon signs, rain-slicked streets, vibrant electric colors, synthwave aesthetic',
    gradient: 'from-fuchsia-600 to-cyan-500',
  },
  {
    id: 'nature',
    label: 'Nature',
    icon: 'nature',
    promptSnippet: 'beautiful natural landscape, lush greenery, soft natural lighting, peaceful serene environment, photorealistic',
    gradient: 'from-green-600 to-emerald-500',
  },
];

export function buildPrompt(userPrompt: string, presetId: string | null): string {
  const parts: string[] = [];

  if (userPrompt.trim()) {
    parts.push(userPrompt.trim());
  }

  if (presetId) {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (preset) {
      parts.push(preset.promptSnippet);
    }
  }

  if (parts.length === 0) {
    return 'beautiful abstract background, vibrant colors, high quality';
  }

  return parts.join(', ');
}
