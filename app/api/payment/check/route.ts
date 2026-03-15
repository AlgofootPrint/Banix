export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RECIPIENT_ADDRESS } from '@/lib/solana';

const LAMPORTS_PER_SOL = 1_000_000_000;

interface HeliusTransfer {
  fromUserAccount: string;
  toUserAccount: string;
  amount: number;
}

interface HeliusTx {
  signature: string;
  timestamp: number;
  nativeTransfers?: HeliusTransfer[];
}

function getHellusApiKey(): string {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? '';
  return rpcUrl.split('api-key=')[1] ?? '';
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { plan, billing, solAmount } = await req.json() as {
    plan: string;
    billing: string;
    solAmount: number;
  };

  const apiKey = getHellusApiKey();
  if (!apiKey) {
    return NextResponse.json({ status: 'error', message: 'RPC not configured' }, { status: 500 });
  }

  try {
    // Fetch recent transactions to the recipient wallet via Helius
    const res = await fetch(
      `https://api.helius.xyz/v0/addresses/${RECIPIENT_ADDRESS}/transactions?api-key=${apiKey}&limit=25`,
      { cache: 'no-store' }
    );

    if (!res.ok) {
      return NextResponse.json({ status: 'error', message: 'Failed to fetch transactions' }, { status: 500 });
    }

    const transactions: HeliusTx[] = await res.json();

    const expectedLamports = Math.round(solAmount * LAMPORTS_PER_SOL);
    const tolerance = Math.max(Math.round(expectedLamports * 0.05), 5000); // 5% or min 5000 lamports
    const cutoffTime = Math.floor(Date.now() / 1000) - 45 * 60; // last 45 minutes

    const match = transactions.find((tx) => {
      if (tx.timestamp < cutoffTime) return false;
      return tx.nativeTransfers?.some(
        (t) =>
          t.toUserAccount === RECIPIENT_ADDRESS &&
          Math.abs(t.amount - expectedLamports) <= tolerance
      );
    });

    if (!match) {
      return NextResponse.json({ status: 'not_found' });
    }

    // Payment confirmed — upsert user plan using admin client (bypasses RLS)
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (billing === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000
    );

    const admin = createAdminClient();
    const { error: dbError } = await admin.from('user_plans').upsert({
      user_id:    user.id,
      plan,
      billing,
      expires_at: expiresAt.toISOString(),
      updated_at: now.toISOString(),
    });

    if (dbError) {
      console.error('Plan upsert error:', dbError);
      return NextResponse.json({
        status: 'error',
        message: `Plan update failed: ${dbError.message}`,
      });
    }

    return NextResponse.json({ status: 'success', plan, billing, signature: match.signature });

  } catch (err) {
    console.error('Payment check error:', err);
    return NextResponse.json({ status: 'error', message: 'Verification failed. Try again.' }, { status: 500 });
  }
}
