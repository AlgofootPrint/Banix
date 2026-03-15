import { Connection, PublicKey } from '@solana/web3.js';

export const RECIPIENT_ADDRESS = '32Jpfehs79JtrhA2Gp3yTmbW22NVskE6xz7BS3WUxfTi';
export const RECIPIENT_PUBKEY = new PublicKey(RECIPIENT_ADDRESS);

export function getConnection(): Connection {
  const rpcUrl = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
  return new Connection(rpcUrl, 'confirmed');
}

export async function getSolPrice(): Promise<number> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      { next: { revalidate: 60 }, signal: controller.signal }
    );
    const data = await res.json();
    return data.solana.usd as number;
  } finally {
    clearTimeout(timeout);
  }
}

export function usdToSol(usd: number, solPrice: number): number {
  return Math.round((usd / solPrice) * 1_000_000) / 1_000_000;
}

export const PLAN_PRICES: Record<string, Record<string, number>> = {
  pro:  { monthly: 5,  yearly: 50  },
  plus: { monthly: 10, yearly: 100 },
};
