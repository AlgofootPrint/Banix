'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();
import { PRESETS } from '@/lib/presets';
import type { ImageMode } from '@/lib/types';

/* ─── tiny section wrapper ─── */
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden w-full">
      <div className="px-6 py-5 border-b border-zinc-800">
        <h2 className="text-sm font-semibold text-white">{title}</h2>
        {description && <p className="text-xs text-zinc-500 mt-1">{description}</p>}
      </div>
      <div className="px-6 py-6 flex flex-col gap-6">{children}</div>
    </div>
  );
}

/* ─── row label ─── */
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
      <div className="sm:w-48 shrink-0">
        <p className="text-sm text-zinc-300">{label}</p>
        {hint && <p className="text-xs text-zinc-600 mt-0.5">{hint}</p>}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ─── saved toast ─── */
function SavedBadge({ show }: { show: boolean }) {
  return (
    <span className={`text-xs text-green-400 transition-opacity duration-300 ${show ? 'opacity-100' : 'opacity-0'}`}>
      Saved
    </span>
  );
}

export default function SettingsPage() {
  const router = useRouter();

  /* Generation prefs */
  const [defaultMode, setDefaultMode] = useState<ImageMode>('banner');
  const [defaultPreset, setDefaultPreset] = useState<string>('none');
  const [safeZoneDefault, setSafeZoneDefault] = useState(true);
  const [genSaved, setGenSaved] = useState(false);

  /* API / Token */
  const [provider, setProvider] = useState<'huggingface' | 'replicate' | 'fal' | 'together' | 'stability' | 'openai' | 'fireworks' | 'deepinfra' | 'novita' | 'ideogram'>('huggingface');
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [tokenSaved, setTokenSaved] = useState(false);
  const [tokenValidating, setTokenValidating] = useState(false);
  const [tokenValid, setTokenValid] = useState<boolean | null>(null);
  const [tokenUsername, setTokenUsername] = useState<string | null>(null);

  /* Export */
  const [filenamePattern, setFilenamePattern] = useState('banix-{date}-{mode}');
  const [exportFormat, setExportFormat] = useState<'png' | 'webp'>('png');
  const [exportSaved, setExportSaved] = useState(false);

  /* Account */
  const [userEmail, setUserEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /* Load from localStorage on mount */
  useEffect(() => {
    const gen = localStorage.getItem('banix_gen_prefs');
    if (gen) {
      try {
        const p = JSON.parse(gen);
        if (p.defaultMode) setDefaultMode(p.defaultMode);
        if (p.defaultPreset) setDefaultPreset(p.defaultPreset);
        if (typeof p.safeZoneDefault === 'boolean') setSafeZoneDefault(p.safeZoneDefault);
      } catch {}
    }

    const tok = localStorage.getItem('banix_api_token');
    if (tok) {
      try {
        const t = JSON.parse(tok);
        if (t.provider) setProvider(t.provider);
        if (t.token) setApiToken(t.token);
      } catch {}
    }

    const exp = localStorage.getItem('banix_export_prefs');
    if (exp) {
      try {
        const e = JSON.parse(exp);
        if (e.filenamePattern) setFilenamePattern(e.filenamePattern);
        if (e.exportFormat) setExportFormat(e.exportFormat);
      } catch {}
    }

    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
    });
  }, []);

  function flash(setter: (v: boolean) => void) {
    setter(true);
    setTimeout(() => setter(false), 2000);
  }

  function saveGeneration() {
    localStorage.setItem('banix_gen_prefs', JSON.stringify({ defaultMode, defaultPreset, safeZoneDefault }));
    flash(setGenSaved);
  }

  function saveToken() {
    localStorage.setItem('banix_api_token', JSON.stringify({ provider, token: apiToken }));
    flash(setTokenSaved);
  }

  async function validateToken() {
    if (!apiToken) return;
    setTokenValidating(true);
    setTokenValid(null);
    setTokenUsername(null);
    try {
      const res = await fetch('/api/validate-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: apiToken, provider }),
      });
      const data = await res.json();
      setTokenValid(data.valid);
      setTokenUsername(data.username ?? null);
    } catch {
      setTokenValid(false);
    } finally {
      setTokenValidating(false);
    }
  }

  function saveExport() {
    localStorage.setItem('banix_export_prefs', JSON.stringify({ filenamePattern, exportFormat }));
    flash(setExportSaved);
  }

  async function handlePasswordReset() {
    if (!userEmail) return;
    await supabase.auth.resetPasswordForEmail(userEmail);
    setResetSent(true);
  }

  async function handleDeleteAccount() {
    setDeleting(true);
    const res = await fetch('/api/delete-account', { method: 'DELETE' });
    if (res.ok) {
      await supabase.auth.signOut();
      router.push('/auth');
    } else {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  /* shared input / select styles */
  const inputCls = 'w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-500 transition-colors';
  const selectCls = inputCls;

  return (
    <div className="text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6">

        {/* Breadcrumb + header */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => router.push('/')}
              className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest hover:text-white transition-colors"
            >
              Banix
            </button>
            <span className="text-zinc-700 text-xs">/</span>
            <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Settings</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-zinc-500 text-sm mt-1">Manage your preferences and integrations.</p>
        </div>

        {/* ── 2-col layout ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

        {/* ── Generation ── */}
        <Section title="Generation" description="Default values applied when you open the generator.">
          <Row label="Default mode">
            <div className="flex gap-2">
              {(['banner', 'pfp'] as ImageMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setDefaultMode(m)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium border transition-colors capitalize ${
                    defaultMode === m
                      ? 'bg-red-600/20 border-red-500/60 text-red-300'
                      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {m === 'banner' ? 'Banner' : 'Profile Pic'}
                </button>
              ))}
            </div>
          </Row>

          <Row label="Default style preset">
            <select
              value={defaultPreset}
              onChange={(e) => setDefaultPreset(e.target.value)}
              className={selectCls}
            >
              <option value="none">None</option>
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </Row>

          <Row label="Safe zone overlay" hint="Show safe zone guide by default on banner previews.">
            <button
              onClick={() => setSafeZoneDefault(!safeZoneDefault)}
              className={`relative inline-flex items-center w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none ${safeZoneDefault ? 'bg-red-600' : 'bg-zinc-700'}`}
            >
              <span className={`inline-block w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${safeZoneDefault ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </Row>

          <div className="flex items-center justify-between pt-1">
            <SavedBadge show={genSaved} />
            <button
              onClick={saveGeneration}
              className="ml-auto text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4 py-1.5 text-zinc-300 hover:text-white transition-colors"
            >
              Save
            </button>
          </div>
        </Section>

        {/* ── API / Token ── */}
        <Section title="API / Token" description="Use your own API key so generation runs on your quota.">
          <Row label="Provider">
            <select
              value={provider}
              onChange={(e) => { setProvider(e.target.value as typeof provider); setTokenValid(null); }}
              className={selectCls}
            >
              <optgroup label="Recommended">
                <option value="huggingface">Hugging Face</option>
                <option value="replicate">Replicate</option>
                <option value="fal">fal.ai</option>
                <option value="together">Together AI</option>
              </optgroup>
              <optgroup label="More providers">
                <option value="stability">Stability AI</option>
                <option value="openai">OpenAI (DALL·E)</option>
                <option value="fireworks">Fireworks AI</option>
                <option value="deepinfra">DeepInfra</option>
                <option value="novita">Novita AI</option>
                <option value="ideogram">Ideogram</option>
              </optgroup>
            </select>
          </Row>

          <Row label="API key" hint="Stored locally in your browser only.">
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={apiToken}
                onChange={(e) => { setApiToken(e.target.value); setTokenValid(null); }}
                placeholder="Paste your API key…"
                className={`${inputCls} pr-10`}
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
                tabIndex={-1}
              >
                {showToken ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                )}
              </button>
            </div>
          </Row>

          {tokenValid !== null && (
            <p className={`text-xs ${tokenValid ? 'text-green-400' : 'text-red-400'}`}>
              {tokenValid
                ? `Valid${tokenUsername ? ` — logged in as ${tokenUsername}` : ''}`
                : 'Invalid token — check the key and try again'}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <SavedBadge show={tokenSaved} />
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={validateToken}
                disabled={!apiToken || tokenValidating}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4 py-1.5 text-zinc-300 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
              >
                {tokenValidating && <span className="w-3 h-3 border border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />}
                {tokenValidating ? 'Validating…' : 'Validate'}
              </button>
              <button
                onClick={saveToken}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4 py-1.5 text-zinc-300 hover:text-white transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </Section>

        {/* ── Export ── */}
        <Section title="Export" description="Control how images are named and formatted when downloaded.">
          <Row label="Filename pattern" hint="Variables: {date}, {mode}, {preset}">
            <input
              type="text"
              value={filenamePattern}
              onChange={(e) => setFilenamePattern(e.target.value)}
              className={inputCls}
              placeholder="banix-{date}-{mode}"
            />
          </Row>

          <Row label="Format">
            <div className="flex gap-2">
              {(['png', 'webp'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setExportFormat(f)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium border uppercase transition-colors ${
                    exportFormat === f
                      ? 'bg-red-600/20 border-red-500/60 text-red-300'
                      : 'border-zinc-700 text-zinc-500 hover:border-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </Row>

          <div className="flex items-center justify-between pt-1">
            <SavedBadge show={exportSaved} />
            <button
              onClick={saveExport}
              className="ml-auto text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4 py-1.5 text-zinc-300 hover:text-white transition-colors"
            >
              Save
            </button>
          </div>
        </Section>

        {/* ── Account ── */}
        <Section title="Account" description="Manage your login and data.">
          {userEmail && (
            <Row label="Email">
              <p className="text-sm text-zinc-400">{userEmail}</p>
            </Row>
          )}

          <Row label="Password" hint="We'll send a reset link to your email.">
            {resetSent ? (
              <p className="text-xs text-green-400">Reset link sent — check your inbox.</p>
            ) : (
              <button
                onClick={handlePasswordReset}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg px-4 py-1.5 text-zinc-300 hover:text-white transition-colors"
              >
                Send password reset
              </button>
            )}
          </Row>

          <div className="h-px bg-zinc-800" />

          {/* Danger zone */}
          <div>
            <p className="text-xs font-semibold text-red-500 uppercase tracking-widest mb-3">Danger zone</p>
            {!deleteConfirm ? (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="text-xs border border-red-800/60 text-red-500 hover:bg-red-900/20 rounded-lg px-4 py-1.5 transition-colors"
              >
                Delete account & all data
              </button>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-zinc-400">This will permanently delete your account, all saved images, and cannot be undone.</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="text-xs bg-red-700 hover:bg-red-600 text-white rounded-lg px-4 py-1.5 transition-colors disabled:opacity-50"
                  >
                    {deleting ? 'Deleting…' : 'Yes, delete everything'}
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="text-xs border border-zinc-700 text-zinc-400 hover:text-white rounded-lg px-4 py-1.5 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </Section>

        </div> {/* end grid */}

      </div>
    </div>
  );
}
