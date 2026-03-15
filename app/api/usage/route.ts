import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PLAN_LIMITS: Record<string, { banner: number; pfp: number }> = {
  free: { banner: 3, pfp: 3 },
  pro:  { banner: 10, pfp: 10 },
  plus: { banner: 30, pfp: 30 },
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { plan: 'free', bannerCount: 0, pfpCount: 0, bannerLimit: 3, pfpLimit: 3 },
        { status: 200 }
      );
    }

    // Get today's date range (UTC)
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    // Query generation counts for today grouped by mode
    const { data: logs } = await supabase
      .from('generation_log')
      .select('mode')
      .eq('user_id', user.id)
      .gte('created_at', todayStart.toISOString());

    const bannerCount = logs?.filter((r) => r.mode === 'banner').length ?? 0;
    const pfpCount    = logs?.filter((r) => r.mode === 'pfp').length ?? 0;

    // Get user's plan (default to 'free' if no row)
    const { data: planRow } = await supabase
      .from('user_plans')
      .select('plan')
      .eq('user_id', user.id)
      .single();

    const plan = planRow?.plan ?? 'free';
    const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;

    return NextResponse.json({
      plan,
      bannerCount,
      pfpCount,
      bannerLimit: limits.banner,
      pfpLimit:    limits.pfp,
    });
  } catch (err) {
    console.error('Usage API error:', err);
    return NextResponse.json(
      { plan: 'free', bannerCount: 0, pfpCount: 0, bannerLimit: 3, pfpLimit: 3 },
      { status: 200 }
    );
  }
}
