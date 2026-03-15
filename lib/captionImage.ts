// Runs BLIP image captioning entirely in the browser via Transformers.js (ONNX/WASM).
// Model files (~90MB) are downloaded from HuggingFace CDN on first use and cached by the browser.

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – upstream type complexity issue with @huggingface/transformers
let captioner: Awaited<ReturnType<typeof import('@huggingface/transformers').pipeline>> | null = null;

export async function captionImage(file: File): Promise<string> {
  const { pipeline, env } = await import('@huggingface/transformers');

  env.allowLocalModels = false;
  // @ts-expect-error – accessToken not in current type definitions
  env.accessToken = process.env.NEXT_PUBLIC_HF_API_TOKEN ?? '';

  if (!captioner) {
    captioner = await pipeline('image-to-text', 'Xenova/blip-image-captioning-base');
  }

  const dataUrl = await fileToDataUrl(file);
  const result = await (captioner as (input: string) => Promise<Array<{ generated_text: string }>>)(dataUrl);
  return result[0]?.generated_text ?? '';
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
