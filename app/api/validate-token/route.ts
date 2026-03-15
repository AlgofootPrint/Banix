import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { token, provider } = await req.json();

  if (!token || typeof token !== 'string') {
    return NextResponse.json({ valid: false, error: 'No token provided' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    let valid = false;
    let username: string | null = null;

    if (provider === 'huggingface' || !provider) {
      const res = await fetch('https://huggingface.co/api/whoami', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        valid = true;
        username = data.name ?? null;
      }
    } else if (provider === 'replicate') {
      const res = await fetch('https://api.replicate.com/v1/account', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        valid = true;
        username = data.username ?? null;
      }
    } else if (provider === 'fal') {
      // fal.ai doesn't have a simple whoami — check key format validity
      clearTimeout(timeout);
      valid = token.startsWith('fal-') && token.length > 10;
    } else {
      clearTimeout(timeout);
      // For other providers, accept the token as-is (can't validate without making a paid call)
      valid = token.length > 8;
    }

    return NextResponse.json({ valid, username });
  } catch {
    return NextResponse.json({ valid: false, error: 'Validation request timed out or failed' }, { status: 200 });
  }
}
