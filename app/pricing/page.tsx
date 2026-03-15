'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import SolanaPayModal from '@/components/SolanaPayModal';

interface Plan {
  id: string;
  name: string;
  monthlyPrice: number;
  yearlyPrice: number;
  yearlyMonthly: number;
  bannerLimit: number;
  pfpLimit: number;
  features: string[];
  cta: string;
  ctaHref?: string;
  highlighted: boolean;
  free: boolean;
}

const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    monthlyPrice: 0,
    yearlyPrice: 0,
    yearlyMonthly: 0,
    bannerLimit: 3,
    pfpLimit: 3,
    features: [
      '3 banners / day',
      '3 profile pics / day',
      'All style presets',
      'Download at full resolution',
    ],
    cta: 'Get Started',
    ctaHref: '/auth',
    highlighted: false,
    free: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    monthlyPrice: 5,
    yearlyPrice: 50,
    yearlyMonthly: 4.17,
    bannerLimit: 10,
    pfpLimit: 10,
    features: [
      '10 banners / day',
      '10 profile pics / day',
      'All style presets',
      'Save unlimited images',
      'Download at full resolution',
    ],
    cta: 'Upgrade to Pro',
    highlighted: true,
    free: false,
  },
  {
    id: 'plus',
    name: 'Plus',
    monthlyPrice: 10,
    yearlyPrice: 100,
    yearlyMonthly: 8.33,
    bannerLimit: 30,
    pfpLimit: 30,
    features: [
      '30 banners / day',
      '30 profile pics / day',
      'All style presets',
      'Save unlimited images',
      'Priority generation',
      'Download at full resolution',
    ],
    cta: 'Upgrade to Plus',
    highlighted: false,
    free: false,
  },
];

function CheckIcon() {
  return (
    <svg className="w-4 h-4 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function SolanaIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 397 311" fill="none" className="inline-block mr-1">
      <path d="M64.6 237.9a9.7 9.7 0 016.9-2.9h317.5c4.3 0 6.5 5.2 3.4 8.3l-62.7 62.7a9.7 9.7 0 01-6.9 2.9H4.3c-4.3 0-6.5-5.2-3.4-8.3l63.7-62.7z" fill="url(#sa)"/>
      <path d="M64.6 3.5A9.9 9.9 0 0171.5.6h317.5c4.3 0 6.5 5.2 3.4 8.3L329.7 71.6a9.7 9.7 0 01-6.9 2.9H4.3C0 74.5-2.2 69.3.9 66.2L64.6 3.5z" fill="url(#sb)"/>
      <path d="M329.7 120.5a9.7 9.7 0 00-6.9-2.9H4.3c-4.3 0-6.5 5.2-3.4 8.3l62.7 62.7a9.7 9.7 0 006.9 2.9h317.5c4.3 0 6.5-5.2 3.4-8.3l-61.7-62.7z" fill="url(#sc)"/>
      <defs>
        <linearGradient id="sa" x1="360.9" y1="351.4" x2="141.2" y2="-69.3" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/>
        </linearGradient>
        <linearGradient id="sb" x1="264.8" y1="401.6" x2="45.1" y2="-19.1" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/>
        </linearGradient>
        <linearGradient id="sc" x1="312.5" y1="376.7" x2="92.8" y2="-44" gradientUnits="userSpaceOnUse">
          <stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

export default function PricingPage() {
  const router = useRouter();
  const supabase = createClient();

  const [yearly, setYearly] = useState(false);
  const [modal, setModal] = useState<{ plan: string; billing: string } | null>(null);

  async function handleUpgrade(planId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth');
      return;
    }
    setModal({ plan: planId, billing: yearly ? 'yearly' : 'monthly' });
  }

  return (
    <div className="text-white relative">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{ background: 'radial-gradient(ellipse 80% 40% at 50% -10%, rgba(220,38,38,0.07) 0%, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Breadcrumb */}
        <div className="mb-6 flex items-center gap-2">
          <Link href="/" className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest hover:text-white transition-colors">Banix</Link>
          <span className="text-zinc-700 text-xs">/</span>
          <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Pricing</span>
        </div>

        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-zinc-400 text-base max-w-md mx-auto">
            Generate AI-powered YouTube banners and profile pictures. Pay with Solana — directly to wallet, no middlemen.
          </p>
          <div className="flex items-center justify-center gap-2 mt-3">
            <SolanaIcon />
            <span className="text-xs text-zinc-500">Powered by Solana Pay · ~$0.00025 network fee</span>
          </div>
        </div>

        {/* Billing toggle */}
        <div className="flex items-center justify-center gap-3 mb-10">
          <span className={`text-sm font-medium transition-colors ${!yearly ? 'text-white' : 'text-zinc-500'}`}>
            Monthly
          </span>
          <button
            onClick={() => setYearly(!yearly)}
            aria-pressed={yearly}
            className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none"
            style={{ background: yearly ? '#dc2626' : '#3f3f46' }}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                yearly ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
          <span className={`text-sm font-medium transition-colors ${yearly ? 'text-white' : 'text-zinc-500'}`}>
            Yearly
          </span>
          <span className="inline-flex items-center bg-green-900/30 border border-green-700/40 text-green-400 text-xs font-semibold px-2 py-0.5 rounded-full">
            Save ~17%
          </span>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const price        = plan.free ? 0 : yearly ? plan.yearlyPrice  : plan.monthlyPrice;
            const perMonth     = plan.free ? 0 : yearly ? plan.yearlyMonthly : plan.monthlyPrice;
            const yearlySaving = plan.free ? 0 : plan.monthlyPrice * 12 - plan.yearlyPrice;

            return (
              <div
                key={plan.id}
                className={`relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 ${
                  plan.highlighted
                    ? 'border-2 border-red-600 shadow-[0_0_32px_rgba(220,38,38,0.18)] bg-zinc-900'
                    : 'border border-zinc-800 bg-zinc-900'
                }`}
              >
                {/* Top accent */}
                <div
                  className="h-px"
                  style={{
                    background: plan.highlighted
                      ? 'linear-gradient(90deg, transparent, #dc2626, transparent)'
                      : 'linear-gradient(90deg, transparent, rgba(220,38,38,0.25), transparent)',
                  }}
                />

                {/* Most Popular badge */}
                {plan.highlighted && (
                  <div className="absolute top-0 right-5">
                    <span className="bg-red-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-b-md tracking-wide uppercase shadow">
                      Most Popular
                    </span>
                  </div>
                )}

                <div className="p-6 flex flex-col flex-1 gap-5">

                  {/* Name & price */}
                  <div>
                    <h2 className={`text-base font-semibold mb-3 ${plan.highlighted ? 'text-red-400' : 'text-zinc-300'}`}>
                      {plan.name}
                    </h2>

                    {plan.free ? (
                      <div className="flex items-end gap-1.5">
                        <span className="text-4xl font-bold text-white">$0</span>
                        <span className="text-zinc-500 text-sm mb-1.5">forever</span>
                      </div>
                    ) : yearly ? (
                      <>
                        <div className="flex items-end gap-1.5">
                          <span className="text-4xl font-bold text-white">${price}</span>
                          <span className="text-zinc-500 text-sm mb-1.5">/ year</span>
                        </div>
                        <p className="text-zinc-500 text-xs mt-1">
                          ~${perMonth.toFixed(2)}/mo &middot;{' '}
                          <span className="text-green-400 font-medium">save ${yearlySaving}</span>
                        </p>
                      </>
                    ) : (
                      <div className="flex items-end gap-1.5">
                        <span className="text-4xl font-bold text-white">${price}</span>
                        <span className="text-zinc-500 text-sm mb-1.5">/ month</span>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-zinc-800" />

                  {/* Features */}
                  <ul className="flex flex-col gap-2.5 flex-1">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-zinc-300">
                        <CheckIcon />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <div className="mt-auto pt-2">
                    {plan.free ? (
                      <Link
                        href="/auth"
                        className="block w-full py-2.5 rounded-xl text-sm font-semibold text-center transition-all bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700"
                      >
                        {plan.cta}
                      </Link>
                    ) : (
                      <button
                        onClick={() => handleUpgrade(plan.id)}
                        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                          plan.highlighted
                            ? 'text-white hover:opacity-90'
                            : 'bg-zinc-800 hover:bg-zinc-700 text-white border border-zinc-700'
                        }`}
                        style={plan.highlighted ? {
                          background: 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                          boxShadow: '0 0 20px rgba(220,38,38,0.25)',
                        } : undefined}
                      >
                        <SolanaIcon />
                        {plan.cta}
                      </button>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-zinc-600 text-xs mt-8">
          Payments go directly to the creator&apos;s wallet via Solana Pay. No card required. Plans renew manually — you won&apos;t be auto-charged.
        </p>

      </div>

      {/* Payment modal */}
      {modal && (
        <SolanaPayModal
          plan={modal.plan}
          billing={modal.billing}
          onClose={() => setModal(null)}
          onSuccess={() => {
            setModal(null);
            router.push('/account');
          }}
        />
      )}
    </div>
  );
}
