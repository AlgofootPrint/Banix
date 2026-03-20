import { NextRequest, NextResponse } from 'next/server';
import { fal } from '@fal-ai/client';

export const dynamic = 'force-dynamic';
import { buildPrompt } from '@/lib/presets';
import { ImageMode, AIMode } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 120;

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  pro:  10,
  plus: 30,
};

const ANON_LIMIT = 3;

// Banner: 1024×576 (landscape 16:9), PFP: 512×512
const FAL_DIMS: Record<ImageMode, { width: number; height: number }> = {
  banner: { width: 1024, height: 576 },
  pfp:    { width: 512,  height: 512  },
};

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      prompt,
      mode,
      presetId,
      aiMode = 'text2img',
      sourceImage,
      maskImage,
      strength = 0.85,
    } = body as {
      prompt: string;
      mode: ImageMode;
      presetId: string | null;
      aiMode: AIMode;
      sourceImage?: string;
      maskImage?: string;
      strength?: number;
    };

    if (!mode || !['banner', 'pfp'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }
    if (typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
    }
    if (prompt.length > 600) {
      return NextResponse.json({ error: 'Prompt too long (max 600 chars)' }, { status: 400 });
    }
    if (aiMode === 'img2img' && !sourceImage) {
      return NextResponse.json({ error: 'Source image required for image-to-image' }, { status: 400 });
    }
    if (aiMode === 'inpaint' && (!sourceImage || !maskImage)) {
      return NextResponse.json({ error: 'Source image and mask required for inpainting' }, { status: 400 });
    }

    // ── Usage limit check ─────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    if (user) {
      const { data: planRow } = await supabase
        .from('user_plans')
        .select('plan')
        .eq('user_id', user.id)
        .single();

      const plan = planRow?.plan ?? 'free';
      const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

      const { count } = await supabase
        .from('generation_log')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('mode', mode)
        .gte('created_at', todayStart.toISOString());

      if ((count ?? 0) >= limit) {
        return NextResponse.json(
          { error: 'Daily limit reached', limitReached: true, plan, limit },
          { status: 429 }
        );
      }
    } else {
      const ip = getClientIp(req);
      const { count } = await supabase
        .from('generation_log')
        .select('id', { count: 'exact', head: true })
        .is('user_id', null)
        .eq('ip', ip)
        .eq('mode', mode)
        .gte('created_at', todayStart.toISOString());

      if ((count ?? 0) >= ANON_LIMIT) {
        return NextResponse.json(
          { error: 'Daily limit reached', limitReached: true, plan: 'free', limit: ANON_LIMIT },
          { status: 429 }
        );
      }
    }

    // ── Generate via Fal.ai ────────────────────────────────────────
    fal.config({ credentials: process.env.FAL_KEY! });

    const finalPrompt = buildPrompt(prompt ?? '', presetId ?? null);
    const dims = FAL_DIMS[mode];

    let imageUrl: string;

    if (aiMode === 'text2img') {
      const result = await fal.subscribe('fal-ai/flux/dev', {
        input: {
          prompt: finalPrompt,
          image_size: { width: dims.width, height: dims.height },
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: false,
        },
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      imageUrl = (result.data as any).images[0].url;

    } else if (aiMode === 'img2img') {
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const img2imgInput: any = {
        image_url: sourceImage as string,
        prompt: finalPrompt,
        strength,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: false,
      };
      let result: any;
      try {
        result = await fal.subscribe('fal-ai/bytedance/seedream/v5/lite/edit', { input: img2imgInput });
      } catch {
        result = await fal.subscribe('fal-ai/nano-banana-2/edit', { input: img2imgInput });
      }
      imageUrl = (result.data as any).images[0].url;
      /* eslint-enable @typescript-eslint/no-explicit-any */

    } else {
      // inpaint
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const inpaintInput: any = {
        image_url: sourceImage as string,
        mask_url: maskImage as string,
        prompt: finalPrompt,
        strength,
        num_inference_steps: 28,
        guidance_scale: 3.5,
        num_images: 1,
        enable_safety_checker: false,
      };
      let result: any;
      try {
        result = await fal.subscribe('fal-ai/bytedance/seedream/v5/lite/edit', { input: inpaintInput });
      } catch {
        result = await fal.subscribe('fal-ai/nano-banana-2/edit', { input: inpaintInput });
      }
      imageUrl = (result.data as any).images[0].url;
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }

    // Fetch the image from Fal.ai CDN and return bytes
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error('Failed to fetch generated image from Fal.ai');
    const arrayBuffer = await imgRes.arrayBuffer();

    // ── Log the generation ─────────────────────────────────────────
    if (user) {
      await supabase.from('generation_log').insert({ user_id: user.id, mode });
    } else {
      const ip = getClientIp(req);
      await supabase.from('generation_log').insert({ user_id: null, ip, mode });
    }

    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' },
    });

  } catch (err: unknown) {
    const error = err as { status?: number; message?: string };
    const status = error?.status;
    const message = error?.message ?? 'Unknown error';

    if (status === 429) {
      return NextResponse.json(
        { error: 'Rate limit reached', rateLimited: true, retryAfterSeconds: 60 },
        { status: 429, headers: { 'Retry-After': '60' } }
      );
    }
    if (status === 401 || message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Invalid FAL_KEY. Check your .env.local.' },
        { status: 401 }
      );
    }

    console.error('Generate API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
