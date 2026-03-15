import { NextRequest, NextResponse } from 'next/server';
import { Keypair } from '@solana/web3.js';
import { encodeURL } from '@solana/pay';
import BigNumber from 'bignumber.js';
import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { RECIPIENT_PUBKEY, getSolPrice, usdToSol, PLAN_PRICES } from '@/lib/solana';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Must be logged in to upgrade' }, { status: 401 });
  }

  const { plan, billing } = await req.json() as { plan: string; billing: string };

  if (!PLAN_PRICES[plan]?.[billing]) {
    return NextResponse.json({ error: 'Invalid plan or billing period' }, { status: 400 });
  }

  try {
    const usdAmount = PLAN_PRICES[plan][billing];
    const solPrice = await getSolPrice();
    const solAmount = usdToSol(usdAmount, solPrice);

    // Unique reference key for this payment — used to verify on-chain
    const reference = Keypair.generate();

    const url = encodeURL({
      recipient: RECIPIENT_PUBKEY,
      amount: new BigNumber(solAmount),
      reference: reference.publicKey,
      label: 'Banix',
      message: `Banix ${plan} plan — ${billing}`,
    });

    const qrCode = await QRCode.toDataURL(url.toString(), {
      width: 280,
      margin: 2,
      color: { dark: '#ffffff', light: '#18181b' },
    });

    return NextResponse.json({
      url: url.toString(),
      reference: reference.publicKey.toBase58(),
      solAmount,
      usdAmount,
      solPrice,
      qrCode,
    });
  } catch (err) {
    console.error('Payment create error:', err);
    return NextResponse.json({ error: 'Failed to create payment request' }, { status: 500 });
  }
}
