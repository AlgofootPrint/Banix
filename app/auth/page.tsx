'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

function BanixLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="40" height="40" rx="9" fill="#dc2626" />
      <rect x="8" y="8" width="5" height="24" fill="white" />
      <path d="M10 8H19Q27 8 27 14Q27 20 19 20H10Z" fill="white" />
      <path d="M10 20H20Q29 20 29 26Q29 32 20 32H10Z" fill="white" />
    </svg>
  );
}

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
    </svg>
  );
}

const FEATURES = [
  { label: 'Banner Generation', desc: 'YouTube-spec 2048×1152 in seconds' },
  { label: 'Profile Pictures', desc: 'Perfect 800×800 AI portraits' },
  { label: '8 Style Presets', desc: 'Gaming, vlog, music, tech & more' },
  { label: 'Save & Download', desc: 'Your gallery, always available' },
];

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();

  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function switchTab(t: 'login' | 'signup') {
    setTab(t);
    setError(null);
    setSuccess(null);
    setShowPassword(false);
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setLoading(true);
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `https://banix.vercel.app/auth/callback` },
    });
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    if (tab === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) { setError(error.message); }
      else { router.push('/'); router.refresh(); }
    } else {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      });
      if (error) { setError(error.message); }
      else { setSuccess('Check your email to confirm your account.'); }
    }
    setLoading(false);
  }

  const inputCls = 'w-full bg-zinc-900/80 border border-zinc-700/60 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-red-500/60 focus:ring-1 focus:ring-red-500/20 transition-all';

  return (
    <div className="min-h-screen bg-zinc-950 flex overflow-hidden">

      {/* ── Dot-grid background ── */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* ── Red glow top-right ── */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-0"
        style={{
          top: '-20%', right: '-10%',
          width: '600px', height: '600px',
          background: 'radial-gradient(circle, rgba(220,38,38,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
      />
      {/* ── Red glow bottom-left ── */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-0"
        style={{
          bottom: '-20%', left: '-10%',
          width: '500px', height: '500px',
          background: 'radial-gradient(circle, rgba(220,38,38,0.07) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* ── Left branding panel ── */}
      <div className="hidden lg:flex relative z-10 w-[520px] shrink-0 flex-col justify-between p-14 border-r border-zinc-800/50">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <BanixLogo size={36} />
          <span className="text-white font-mono text-lg tracking-widest">BANIX™</span>
        </div>

        {/* Hero copy */}
        <div className="flex flex-col gap-10">
          <div>
            <p className="text-[11px] font-mono text-red-500 uppercase tracking-widest mb-4">AI Image Generator</p>
            <h2 className="text-3xl font-bold text-white leading-tight mb-4">
              Create stunning<br />YouTube visuals<br />in seconds.
            </h2>
            <p className="text-zinc-500 text-sm leading-relaxed max-w-xs">
              Banners and profile pictures generated by state-of-the-art AI, spec-perfect for YouTube — no design skills needed.
            </p>
          </div>

          {/* Feature list */}
          <ul className="flex flex-col gap-px overflow-hidden rounded-2xl border border-zinc-800/80">
            {FEATURES.map(({ label, desc }, i) => (
              <li
                key={label}
                className="flex items-center justify-between px-5 py-3.5 bg-zinc-900/40 backdrop-blur-sm"
                style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}
              >
                <div className="flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                  <span className="text-sm text-zinc-200 font-medium">{label}</span>
                </div>
                <span className="text-xs text-zinc-600">{desc}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-xs text-zinc-700">© {new Date().getFullYear()} BANIX™ · All rights reserved</p>
      </div>

      {/* ── Right form panel ── */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center px-4 py-12">

        <div className="w-full max-w-[400px]">

          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center gap-3 mb-10">
            <BanixLogo size={48} />
            <span className="text-white font-mono text-base tracking-widest">BANIX™</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {tab === 'login' ? 'Welcome back' : 'Get started free'}
            </h1>
            <p className="text-zinc-500 text-sm mt-1.5">
              {tab === 'login'
                ? 'Sign in to your account to continue.'
                : 'Create an account — no credit card required.'}
            </p>
          </div>

          {/* Glassmorphism card */}
          <div
            className="rounded-2xl border border-zinc-800/80 overflow-hidden"
            style={{
              background: 'rgba(24,24,27,0.7)',
              backdropFilter: 'blur(20px)',
              boxShadow: '0 0 0 1px rgba(255,255,255,0.03), 0 24px 48px rgba(0,0,0,0.4)',
            }}
          >
            {/* Top accent */}
            <div className="h-px bg-gradient-to-r from-transparent via-red-500/50 to-transparent" />

            {/* Tab switcher */}
            <div className="flex p-3 gap-1 border-b border-zinc-800/60">
              {(['login', 'signup'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => switchTab(t)}
                  className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
                    tab === t
                      ? 'bg-zinc-800 text-white shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {t === 'login' ? 'Log In' : 'Sign Up'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">

              {/* OAuth buttons */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => handleOAuth('google')}
                  disabled={loading}
                  className="flex items-center justify-center gap-3 w-full py-2.5 rounded-xl text-sm font-medium text-zinc-200 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 hover:border-zinc-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <button
                  type="button"
                  onClick={() => handleOAuth('github')}
                  disabled={loading}
                  className="flex items-center justify-center gap-3 w-full py-2.5 rounded-xl text-sm font-medium text-zinc-200 bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 hover:border-zinc-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                  </svg>
                  Continue with GitHub
                </button>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-zinc-800" />
                <span className="text-[11px] text-zinc-600 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-zinc-800" />
              </div>

              {tab === 'signup' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Full Name</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Your name"
                    className={inputCls}
                  />
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                  className={inputCls}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">Password</label>
                  {tab === 'login' && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (!email) { setError('Enter your email first.'); return; }
                        await supabase.auth.resetPasswordForEmail(email);
                        setSuccess('Reset link sent — check your inbox.');
                      }}
                      className="text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                    autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
                    className={`${inputCls} pr-11`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-300 transition-colors"
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                {tab === 'signup' && (
                  <p className="text-[11px] text-zinc-600">Minimum 6 characters.</p>
                )}
              </div>

              {error && (
                <div className="flex items-start gap-2.5 text-xs text-red-400 bg-red-950/40 border border-red-900/50 rounded-xl px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                  </svg>
                  {error}
                </div>
              )}
              {success && (
                <div className="flex items-start gap-2.5 text-xs text-green-400 bg-green-950/40 border border-green-900/50 rounded-xl px-3.5 py-2.5">
                  <svg className="w-3.5 h-3.5 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="relative w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1 overflow-hidden group"
                style={{
                  background: loading ? 'rgb(39,39,42)' : 'linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)',
                  boxShadow: loading ? 'none' : '0 0 28px rgba(220,38,38,0.3)',
                }}
              >
                {!loading && (
                  <span
                    aria-hidden
                    className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                  />
                )}
                {loading && <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />}
                <span className="relative">
                  {loading ? 'Please wait…' : tab === 'login' ? 'Log In' : 'Create Account'}
                </span>
              </button>
            </form>

            {/* Switch tab footer */}
            <div className="px-6 pb-5 text-center">
              <p className="text-xs text-zinc-600">
                {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
                <button
                  type="button"
                  onClick={() => switchTab(tab === 'login' ? 'signup' : 'login')}
                  className="text-zinc-400 hover:text-white transition-colors underline underline-offset-2"
                >
                  {tab === 'login' ? 'Sign up free' : 'Log in'}
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
