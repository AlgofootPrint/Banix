import { NextRequest, NextResponse } from 'next/server';
import { InferenceClient } from '@huggingface/inference';

export const dynamic = 'force-dynamic';
import { buildPrompt } from '@/lib/presets';
import { HF_DIMS, ImageMode } from '@/lib/types';
import { createClient } from '@/lib/supabase/server';

export const maxDuration = 120;

const PLAN_LIMITS: Record<string, number> = {
  free: 3,
  pro:  10,
  plus: 30,
};

// Anonymous users are capped at 3 per mode per day (same as free)
const ANON_LIMIT = 3;

let hfClient: InferenceClient | null = null;
function getHfClient(): InferenceClient {
  if (!hfClient) hfClient = new InferenceClient(process.env.HF_API_TOKEN!);
  return hfClient;
}

function getClientIp(req: NextRequest): string {
  // x-real-ip is set by the trusted reverse proxy (Vercel/Nginx) — prefer it.
  // Fall back to the first entry in x-forwarded-for as a best-effort.
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prompt, mode, presetId } = body as {
      prompt: string;
      mode: ImageMode;
      presetId: string | null;
    };

    if (!mode || !['banner', 'pfp'].includes(mode)) {
      return NextResponse.json({ error: 'Invalid mode' }, { status: 400 });
    }

    if (typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Invalid prompt' }, { status: 400 });
    }
    if (prompt.length > 500) {
      return NextResponse.json({ error: 'Prompt too long (max 500 chars)' }, { status: 400 });
    }

    // ── Usage limit check ─────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    if (user) {
      // Authenticated user: check their plan and today's count
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

      const usedCount = count ?? 0;

      if (usedCount >= limit) {
        return NextResponse.json(
          { error: 'Daily limit reached', limitReached: true, plan, limit },
          { status: 429 }
        );
      }
    } else {
      // Anonymous user: check by IP
      const ip = getClientIp(req);

      const { count } = await supabase
        .from('generation_log')
        .select('id', { count: 'exact', head: true })
        .is('user_id', null)
        .eq('ip', ip)
        .eq('mode', mode)
        .gte('created_at', todayStart.toISOString());

      const usedCount = count ?? 0;

      if (usedCount >= ANON_LIMIT) {
        return NextResponse.json(
          { error: 'Daily limit reached', limitReached: true, plan: 'free', limit: ANON_LIMIT },
          { status: 429 }
        );
      }
    }

    // ── Generate image ─────────────────────────────────────────────
    const finalPrompt = buildPrompt(prompt ?? '', presetId ?? null);
    const dims = HF_DIMS[mode];
    const customToken = req.headers.get('x-api-token');
    const hf = customToken ? new InferenceClient(customToken) : getHfClient();
    const blob = await hf.textToImage(
      {
        model: 'black-forest-labs/FLUX.1-schnell',
        inputs: finalPrompt,
        parameters: {
          width: dims.width,
          height: dims.height,
          num_inference_steps: 4,
          guidance_scale: 0,
        },
      },
      { outputType: 'blob' }
    );

    // ── Log the generation ─────────────────────────────────────────
    if (user) {
      await supabase.from('generation_log').insert({
        user_id: user.id,
        mode,
      });
    } else {
      const ip = getClientIp(req);
      await supabase.from('generation_log').insert({
        user_id: null,
        ip,
        mode,
      });
    }

    const arrayBuffer = await blob.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' },
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
    if (status === 503) {
      return NextResponse.json(
        { error: 'Model is loading', modelLoading: true, retryAfterSeconds: 30 },
        { status: 503, headers: { 'Retry-After': '30' } }
      );
    }
    if (status === 401) {
      return NextResponse.json(
        { error: 'Invalid API token. Check your HF_API_TOKEN in .env.local.' },
        { status: 401 }
      );
    }

    console.error('API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
