'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { User } from '@supabase/supabase-js';

interface SavedImage {
  id: string;
  prompt: string | null;
  mode: string;
  preset_id: string | null;
  public_url: string;
  created_at: string;
}

const supabase = createClient();

export default function AccountPage() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [images, setImages] = useState<SavedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (cancelled) return;
      if (!user) { router.push('/auth'); return; }
      setUser(user);

      const { data } = await supabase
        .from('saved_images')
        .select('*')
        .order('created_at', { ascending: false });

      if (cancelled) return;
      setImages(data ?? []);
      setLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, [router]);

  async function handleDelete(img: SavedImage) {
    setDeleting(img.id);
    // Remove from storage
    const path = img.public_url.split('/object/public/saved-images/')[1];
    if (path) await supabase.storage.from('saved-images').remove([path]);
    // Remove from DB
    await supabase.from('saved_images').delete().eq('id', img.id);
    setImages((prev) => prev.filter((i) => i.id !== img.id));
    setDeleting(null);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push('/auth');
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-zinc-500 text-sm">
        Loading…
      </div>
    );
  }

  return (
    <div className="text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-y-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <button
                onClick={() => router.push('/')}
                className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest hover:text-white transition-colors"
              >
                Banix
              </button>
              <span className="text-zinc-700 text-xs">/</span>
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">Account</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Account</h1>
            <p className="text-zinc-500 text-sm mt-1">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="text-xs text-zinc-500 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-lg px-3 py-1.5 transition-colors"
          >
            Sign out
          </button>
        </div>

        {/* Saved images */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-300">
            Saved Images
            <span className="ml-2 text-zinc-600 font-normal">{images.length}</span>
          </h2>
        </div>

        {images.length === 0 ? (
          <div className="border border-zinc-800 rounded-2xl p-12 text-center text-zinc-600 text-sm">
            No saved images yet. Generate one and hit Save!
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden group"
              >
                <div className="relative aspect-video bg-zinc-800">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.public_url}
                    alt={img.prompt ?? 'Saved image'}
                    className="w-full h-full object-cover"
                  />
                  {/* Overlay actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                    <a
                      href={img.public_url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                      title="Download"
                    >
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                    </a>
                    <button
                      onClick={() => handleDelete(img)}
                      disabled={deleting === img.id}
                      className="p-2 bg-red-500/20 hover:bg-red-500/40 rounded-lg transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      img.mode === 'banner'
                        ? 'bg-red-900/30 text-red-400'
                        : 'bg-blue-900/30 text-blue-400'
                    }`}>
                      {img.mode}
                    </span>
                    {img.preset_id && (
                      <span className="text-[10px] text-zinc-600 capitalize">{img.preset_id}</span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {img.prompt || <span className="italic">No prompt</span>}
                  </p>
                  <p className="text-[10px] text-zinc-700 mt-1">
                    {new Date(img.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
