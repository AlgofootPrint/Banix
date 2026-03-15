export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { PublicKey } from '@solana/web3.js';
import { findReference, validateTransfer, FindReferenceError, ValidateTransferError } from '@solana/pay';
import BigNumber from 'bignumber.js';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getConnection, RECIPIENT_PUBKEY } from '@/lib/solana';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const referenceStr = searchParams.get('reference');
  const plan        = searchParams.get('plan');
  const billing     = searchParams.get('billing');
  const solAmount   = searchParams.get('solAmount');

  if (!referenceStr || !plan || !billing || !solAmount) {
    return NextResponse.json({ error: 'Missing params' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const connection = getConnection();
  const reference  = new PublicKey(referenceStr);

  try {
    const signatureInfo = await findReference(connection, reference, { finality: 'confirmed' });

    await validateTransfer(
      connection,
      signatureInfo.signature,
      {
        recipient: RECIPIENT_PUBKEY,
        amount: new BigNumber(solAmount),
        reference,
      },
      { commitment: 'confirmed' }
    );

    // Payment confirmed — calculate expiry
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + (billing === 'yearly' ? 365 : 30) * 24 * 60 * 60 * 1000
    );

    const admin = createAdminClient();
    const { error } = await admin.from('user_plans').upsert({
      user_id:    user.id,
      plan,
      billing,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Plan update error:', error);
      return NextResponse.json({
        status: 'error',
        message: `Payment received but plan update failed: ${error.message}`,
      });
    }

    return NextResponse.json({ status: 'success', plan, billing });

  } catch (e) {
    if (e instanceof FindReferenceError) {
      return NextResponse.json({ status: 'pending' });
    }
    if (e instanceof ValidateTransferError) {
      return NextResponse.json({ status: 'invalid', message: 'Transfer amount or recipient mismatch' });
    }
    console.error('Verify error:', e);
    return NextResponse.json({ status: 'pending' });
  }
}
