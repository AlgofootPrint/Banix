import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const { compositeImage, maskImage, prompt } = await req.json();

    if (!compositeImage || !maskImage) {
      return NextResponse.json({ error: 'compositeImage and maskImage required' }, { status: 400 });
    }

    fal.config({ credentials: process.env.FAL_KEY! });

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const input: any = {
      image_url: compositeImage,
      mask_url: maskImage,
      prompt: prompt || 'seamlessly extend the scene beyond the image border, perfectly matching the existing colors, lighting, style, and atmosphere',
      num_inference_steps: 28,
      guidance_scale: 3.5,
      num_images: 1,
      enable_safety_checker: false,
    };

    // flux-pro/v1/fill is purpose-built for masked outpainting —
    // it preserves non-masked areas exactly and extends the scene into masked regions.
    const result = await fal.subscribe('fal-ai/flux-pro/v1/fill', { input });
    const imageUrl = (result.data as any).images[0].url;
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error('Failed to fetch outpainted image from Fal.ai');
    const arrayBuffer = await imgRes.arrayBuffer();

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' },
    });
  } catch (err: unknown) {
    const error = err as { message?: string };
    console.error('Outpaint error:', error?.message);
    return NextResponse.json({ error: error?.message ?? 'Outpaint failed' }, { status: 500 });
  }
}
