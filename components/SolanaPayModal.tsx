'use client';

import { useEffect, useRef, useState } from 'react';

interface PaymentData {
  url: string;
  reference: string;
  solAmount: number;
  usdAmount: number;
  solPrice: number;
  qrCode: string;
}

interface Props {
  plan: string;
  billing: string;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'loading' | 'ready' | 'checking' | 'success' | 'error';

export default function SolanaPayModal({ plan, billing, onClose, onSuccess }: Props) {
  const [step, setStep]         = useState<Step>('loading');
  const [payment, setPayment]   = useState<PaymentData | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);
  const [copiedAddr, setCopiedAddr] = useState(false);
  const [checking, setChecking] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    createPayment();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createPayment() {
    setStep('loading');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/payment/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billing }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error ?? 'Failed to create payment');
        setStep('error');
        return;
      }
      setPayment(data as PaymentData);
      setStep('ready');
      startPolling(data as PaymentData);
    } catch {
      setErrorMsg('Network error. Please try again.');
      setStep('error');
    }
  }

  function startPolling(data: PaymentData) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payment/verify?reference=${data.reference}&plan=${plan}&billing=${billing}&solAmount=${data.solAmount}`
        );
        const result = await res.json();
        if (result.status === 'success') {
          clearInterval(pollRef.current!);
          setStep('success');
          setTimeout(onSuccess, 2500);
        } else if (result.status === 'invalid') {
          clearInterval(pollRef.current!);
          setErrorMsg('Transfer validation failed. Please contact support.');
          setStep('error');
        }
      } catch { /* keep polling */ }
    }, 3000);
  }

  async function handleManualCheck() {
    if (!payment || checking) return;
    setChecking(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/payment/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billing, solAmount: payment.solAmount }),
      });
      const result = await res.json();
      if (result.status === 'success') {
        if (pollRef.current) clearInterval(pollRef.current);
        setStep('success');
        setTimeout(onSuccess, 2500);
      } else if (result.status === 'not_found') {
        setErrorMsg('Payment not found yet. Make sure you sent exactly ' + payment.solAmount + ' SOL to the address, then try again.');
      } else {
        setErrorMsg(result.message ?? 'Verification failed. Try again.');
      }
    } catch {
      setErrorMsg('Network error. Please try again.');
    } finally {
      setChecking(false);
    }
  }

  async function copyAddress() {
    if (!payment) return;
    await navigator.clipboard.writeText(payment.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyWalletAddress() {
    if (!payment) return;
    const address = payment.url.split('?')[0].replace('solana:', '');
    await navigator.clipboard.writeText(address);
    setCopiedAddr(true);
    setTimeout(() => setCopiedAddr(false), 2000);
  }

  const planLabel    = plan.charAt(0).toUpperCase() + plan.slice(1);
  const billingLabel = billing === 'yearly' ? '/year' : '/month';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl shadow-black/50">

        {/* Top accent */}
        <div className="h-px bg-gradient-to-r from-transparent via-red-600/60 to-transparent" />

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            {/* Solana logo */}
            <svg width="18" height="18" viewBox="0 0 397 311" fill="none">
              <path d="M64.6 237.9a9.7 9.7 0 016.9-2.9h317.5c4.3 0 6.5 5.2 3.4 8.3l-62.7 62.7a9.7 9.7 0 01-6.9 2.9H4.3c-4.3 0-6.5-5.2-3.4-8.3l63.7-62.7z" fill="url(#a)"/>
              <path d="M64.6 3.5A9.9 9.9 0 0171.5.6h317.5c4.3 0 6.5 5.2 3.4 8.3L329.7 71.6a9.7 9.7 0 01-6.9 2.9H4.3C0 74.5-2.2 69.3.9 66.2L64.6 3.5z" fill="url(#b)"/>
              <path d="M329.7 120.5a9.7 9.7 0 00-6.9-2.9H4.3c-4.3 0-6.5 5.2-3.4 8.3l62.7 62.7a9.7 9.7 0 006.9 2.9h317.5c4.3 0 6.5-5.2 3.4-8.3l-61.7-62.7z" fill="url(#c)"/>
              <defs>
                <linearGradient id="a" x1="360.9" y1="351.4" x2="141.2" y2="-69.3" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/>
                </linearGradient>
                <linearGradient id="b" x1="264.8" y1="401.6" x2="45.1" y2="-19.1" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/>
                </linearGradient>
                <linearGradient id="c" x1="312.5" y1="376.7" x2="92.8" y2="-44" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#00FFA3"/><stop offset="1" stopColor="#DC1FFF"/>
                </linearGradient>
              </defs>
            </svg>
            <div>
              <h2 className="text-white font-semibold text-sm">Upgrade to {planLabel}</h2>
              <p className="text-zinc-500 text-[11px]">Pay with Solana</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5">

          {/* Loading */}
          {step === 'loading' && (
            <div className="flex flex-col items-center gap-3 py-10">
              <span className="w-8 h-8 border-2 border-zinc-700 border-t-red-500 rounded-full animate-spin" />
              <p className="text-zinc-400 text-sm">Generating payment request…</p>
            </div>
          )}

          {/* Ready — show QR */}
          {step === 'ready' && payment && (
            <div className="flex flex-col items-center gap-4">

              {/* Amount */}
              <div className="text-center">
                <p className="text-3xl font-bold text-white">{payment.solAmount} <span className="text-lg text-zinc-400">SOL</span></p>
                <p className="text-zinc-500 text-xs mt-1">
                  ≈ ${payment.usdAmount}{billingLabel} · 1 SOL = ${payment.solPrice.toLocaleString()}
                </p>
              </div>

              {/* QR Code */}
              <div className="bg-[#18181b] p-3 rounded-xl border border-zinc-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={payment.qrCode} alt="Solana Pay QR Code" className="w-56 h-56 rounded-lg" />
              </div>

              <p className="text-zinc-500 text-xs text-center leading-relaxed">
                Scan with <span className="text-white">Phantom</span>, <span className="text-white">Solflare</span>, or any Solana wallet
              </p>

              {/* Open in wallet (mobile deep link) */}
              <a
                href={payment.url}
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-center text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
                style={{ background: 'linear-gradient(135deg, #9945FF 0%, #7c3aed 100%)' }}
              >
                <svg className="w-4 h-4" viewBox="0 0 40 40" fill="none">
                  <circle cx="20" cy="20" r="20" fill="white" fillOpacity="0.15"/>
                  <path d="M20 10a10 10 0 100 20A10 10 0 0020 10z" fill="white" fillOpacity="0.3"/>
                </svg>
                Open in Wallet
              </a>

              {/* Copy link */}
              <button
                onClick={copyAddress}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                </svg>
                {copied ? 'Copied!' : 'Copy payment link'}
              </button>

              {/* Wallet address */}
              <div className="w-full bg-zinc-800/60 border border-zinc-700/50 rounded-xl px-3.5 py-2.5 flex items-center gap-2">
                <span className="flex-1 text-[11px] font-mono text-zinc-400 truncate">
                  {payment.url.split('?')[0].replace('solana:', '')}
                </span>
                <button
                  onClick={copyWalletAddress}
                  className="shrink-0 text-zinc-500 hover:text-white transition-colors"
                  aria-label="Copy wallet address"
                >
                  {copiedAddr ? (
                    <svg className="w-3.5 h-3.5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Manual confirm button */}
              <button
                onClick={handleManualCheck}
                disabled={checking}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-zinc-600 hover:border-zinc-400 text-zinc-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {checking ? (
                  <>
                    <span className="w-3.5 h-3.5 border-2 border-zinc-500/30 border-t-zinc-300 rounded-full animate-spin" />
                    Checking wallet…
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    I&apos;ve Paid — Confirm Now
                  </>
                )}
              </button>

              {/* Manual check error */}
              {errorMsg && (
                <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2 text-center leading-relaxed">
                  {errorMsg}
                </p>
              )}

              {/* Polling pulse */}
              <div className="flex items-center gap-2 text-[11px] text-zinc-600">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                Also auto-checking every 3s…
              </div>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/15 border border-green-500/30 flex items-center justify-center">
                <svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-base">Payment confirmed!</p>
                <p className="text-zinc-400 text-sm mt-1">
                  Your <span className="text-white">{planLabel}</span> plan is now active.
                </p>
                <p className="text-zinc-600 text-xs mt-2">Redirecting…</p>
              </div>
            </div>
          )}

          {/* Error — payment creation failed */}
          {step === 'error' && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <svg className="w-7 h-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
              <p className="text-zinc-300 text-sm">{errorMsg}</p>
              <button
                onClick={createPayment}
                className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors"
              >
                Try again
              </button>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 pb-4 text-center">
          <p className="text-[10px] text-zinc-700">
            Payments are processed on-chain via Solana Pay. No personal data stored.
          </p>
        </div>
      </div>
    </div>
  );
}
