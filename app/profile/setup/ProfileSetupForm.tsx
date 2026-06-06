'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function ProfileSetupForm({
  userId,
  initialUsername,
  initialBio,
  initialContactLink,
}: {
  userId: string;
  initialUsername: string;
  initialBio: string;
  initialContactLink: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio);
  const [contactLink, setContactLink] = useState(initialContactLink);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const trimmedUsername = username.trim();
    const trimmedBio = bio.trim();
    const trimmedContactLink = contactLink.trim();

    if (!trimmedUsername) {
      setError('Username is required');
      setLoading(false);
      return;
    }

    const { data: existingProfile, error: lookupError } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', trimmedUsername)
      .neq('id', userId)
      .maybeSingle();

    if (lookupError) {
      setError(lookupError.message);
      setLoading(false);
      return;
    }

    if (existingProfile) {
      setError('Username already taken');
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        username: trimmedUsername,
        bio: trimmedBio || null,
        contact_link: trimmedContactLink || null,
      },
      { onConflict: 'id' },
    );

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    router.push('/');
    setLoading(false);
  };

  return (
    <main className='min-h-screen bg-[#071018] text-white'>
      <section className='mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8'>
        <div className='grid w-full gap-8 rounded-3xl border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/30 backdrop-blur md:grid-cols-[1.02fr_0.98fr] md:p-10'>
          <article className='space-y-6 rounded-3xl border border-white/8 bg-black/30 p-6 md:p-8'>
            <p className='text-sm uppercase tracking-[0.3em] text-[#e8d5b7]'>PlotTwist</p>
            <h1 className='max-w-md text-4xl font-black tracking-tight text-white md:text-5xl'>Set up your PlotTwist profile</h1>
            <p className='max-w-md text-base text-slate-300 md:text-lg'>Create a clear profile for the people you’ll meet next.</p>
            <ul className='space-y-3 text-sm text-slate-200'>
              <li>• Pick a username that feels like you.</li>
              <li>• Add a short bio and link people can use to reach you.</li>
              <li>• We’ll keep the setup quick and minimal.</li>
            </ul>
          </article>

          <article className='rounded-3xl border border-white/10 bg-[#0b1622] p-6 md:p-8'>
            <form onSubmit={handleSubmit} className='space-y-5'>
              <label className='block text-sm text-slate-200'>
                Username
                <input
                  type='text'
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  className='mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400'
                  placeholder='yourname'
                />
              </label>

              <label className='block text-sm text-slate-200'>
                Bio
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  maxLength={160}
                  rows={4}
                  className='mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400'
                  placeholder='A short intro about you'
                />
                <div className='mt-1 flex items-center justify-between text-xs text-slate-400'>
                  <span>Optional</span>
                  <span>{bio.length}/160</span>
                </div>
              </label>

              <label className='block text-sm text-slate-200'>
                Contact link
                <input
                  type='text'
                  value={contactLink}
                  onChange={(e) => setContactLink(e.target.value)}
                  className='mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400'
                  placeholder='Your Twitter, Instagram, or email link'
                />
              </label>

              {error ? (
                <p className='rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100'>
                  {error}
                </p>
              ) : null}

              <button
                type='submit'
                disabled={loading}
                className='w-full rounded-sm bg-[#e8d5b7] px-4 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#f0e3ce] disabled:cursor-not-allowed disabled:opacity-70'
              >
                {loading ? 'Saving...' : 'Save profile'}
              </button>
            </form>
          </article>
        </div>
      </section>
    </main>
  );
}
