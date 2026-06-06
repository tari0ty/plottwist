'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleEmail = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    router.push('/');
    setLoading(false);
  };

  return (
    <main className='min-h-screen bg-[#071018] text-white'>
      <section className='mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-16 sm:px-6 lg:px-8'>
        <div className='grid w-full gap-8 rounded-3xl border border-white/10 bg-white/6 p-6 shadow-2xl shadow-black/30 backdrop-blur md:grid-cols-[1.05fr_0.95fr] md:p-10'>
          <article className='space-y-6 rounded-3xl border border-white/8 bg-black/30 p-6 md:p-8'>
            <p className='text-sm uppercase tracking-[0.3em] text-[#e8d5b7]'>PlotTwist</p>
            <h1 className='max-w-md text-4xl font-black tracking-tight text-white md:text-5xl'>Welcome back.</h1>
            <p className='max-w-md text-base text-slate-300 md:text-lg'>Sign in with Google or email to continue where you left off.</p>
          </article>
          <article className='rounded-3xl border border-white/10 bg-[#0b1622] p-6 md:p-8'>
            <div className='mb-6 flex items-center justify-between gap-3'>
              <div>
                <p className='text-sm uppercase tracking-[0.25em] text-[#e8d5b7]'>Login</p>
                <h2 className='text-2xl font-bold text-white'>Welcome back</h2>
              </div>
              <Link href='/signup' className='text-sm font-semibold text-[#e8d5b7] hover:text-[#f0e3ce]'>Create account</Link>
            </div>
            <button type='button' onClick={handleGoogle} disabled={loading} className='flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-700 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60'>
              <GoogleMark />
              Continue with Google
            </button>
            <div className='my-6 flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-400'>
              <span className='h-px flex-1 bg-slate-700' />
              or email
              <span className='h-px flex-1 bg-slate-700' />
            </div>
            <form onSubmit={handleEmail} className='space-y-4'>
              <label className='block text-sm text-slate-200'>
                Email
                <input type='email' value={email} onChange={(e) => setEmail(e.target.value)} required className='mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400' placeholder='you@example.com' />
              </label>
              <label className='block text-sm text-slate-200'>
                Password
                <input type='password' value={password} onChange={(e) => setPassword(e.target.value)} required className='mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400' placeholder='Enter your password' />
              </label>
              {error ? <p className='rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100'>{error}</p> : null}
              <button type='submit' disabled={loading} className='w-full rounded-sm bg-[#e8d5b7] px-4 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#f0e3ce] disabled:cursor-not-allowed disabled:opacity-70'>
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>
          </article>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox='0 0 24 24' aria-hidden='true' className='h-5 w-5'>
      <path fill='#EA4335' d='M12 10.2v3.9h5.4c-.2 1.2-.9 2.2-1.9 2.9l3.1 2.4c1.8-1.7 2.8-4.1 2.8-7.1 0-.7-.1-1.4-.2-2H12z' />
      <path fill='#4285F4' d='M12 22c2.7 0 4.9-.9 6.6-2.4l-3.1-2.4c-.9.6-2.1.9-3.5.9-2.6 0-4.8-1.8-5.6-4.2H3.2v2.6C4.9 19.7 8.2 22 12 22z' />
      <path fill='#FBBC05' d='M6.4 14.9c-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9V8.5H3.2C2.4 9.7 2 10.9 2 12.1s.4 2.4 1.2 3.6l3.2-2.8z' />
      <path fill='#34A853' d='M12 6.1c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.9 3.2 14.7 2 12 2 8.2 2 4.9 4.3 3.2 7.4l3.2 2.5c.8-2.4 3-4.2 5.6-4.2z' />
    </svg>
  );
}
