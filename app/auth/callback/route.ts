import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  // On Vercel, use the forwarded host to get the real public URL
  const forwardedHost = request.headers.get('x-forwarded-host');
  const protocol = request.headers.get('x-forwarded-proto') ?? 'https';
  const baseUrl = forwardedHost ? `${protocol}://${forwardedHost}` : origin;

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${baseUrl}${next}`);
    }
  }

  return NextResponse.redirect(`${baseUrl}/auth?error=callback_error`);
}
