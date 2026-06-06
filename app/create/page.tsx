'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

const GENRE_OPTIONS = [
  'Horror',
  'Romance',
  'Comedy',
  'Surreal',
  'Adventure',
  'Thriller',
  'Fantasy',
  'Mystery',
];

export default function CreateStoryPage() {
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Horror');
  const [openingLine, setOpeningLine] = useState('');
  const [maxWriters, setMaxWriters] = useState(5);
  const [turnsPerWriter, setTurnsPerWriter] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError('You must be signed in to create a story.');
      setLoading(false);
      return;
    }

    const { data: storyData, error: storyError } = await supabase
      .from('stories')
      .insert({
        title: title.trim(),
        genre,
        opening_line: openingLine.trim(),
        author_id: userData.user.id,
        max_writers: maxWriters,
        turns_per_writer: turnsPerWriter,
        writer_count: 1,
        status: 'active',
      })
      .select('id')
      .single();

    if (storyError || !storyData) {
      setError(storyError?.message || 'Could not create the story.');
      setLoading(false);
      return;
    }

    const { error: participantError } = await supabase
      .from('story_participants')
      .insert({
        story_id: storyData.id,
        user_id: userData.user.id,
        turn_order: 1,
        has_taken_turn: false,
      });

    if (participantError) {
      setError(participantError.message);
      setLoading(false);
      return;
    }

    router.push(`/story/${storyData.id}`);
    setLoading(false);
  };

  return (
    <main className='min-h-screen bg-[#0a0a0a] text-white'>
      <section className='mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8'>
        <header className='mb-8 flex items-center justify-between gap-3'>
          <Link href='/' className='text-sm font-semibold text-[#e8d5b7] hover:text-[#f0e3ce]'>← Back to home</Link>
          <p className='text-sm uppercase tracking-[0.35em] text-[#e8d5b7]'>Create</p>
        </header>

        <div className='grid gap-8 border border-[#222222] bg-[#111111] p-6 md:grid-cols-[1fr_1.05fr] md:p-10'>
          <article className='space-y-6 border border-[#222222] bg-[#151515] p-6 md:p-8'>
            <p className='text-sm uppercase tracking-[0.3em] text-[#e8d5b7]'>PlotTwist</p>
            <h1 className='font-serif text-4xl font-black tracking-tight text-white md:text-5xl'>Start a story people can join.</h1>
            <p className='text-slate-300'>Set the tone with one sentence, choose the genre, and open the door for collaborators.</p>
            <ul className='space-y-3 text-sm text-slate-200'>
              <li>• The opening line is the sentence that starts everything.</li>
              <li>• Max writers controls how many collaborators can join.</li>
              <li>• Your first turn is reserved as the author.</li>
            </ul>
          </article>

          <article className='border border-[#222222] bg-[#0f0f0f] p-6 md:p-8'>
            <form onSubmit={handleSubmit} className='space-y-5'>
              <label className='block text-sm text-slate-200'>
                Title
                <input
                  type='text'
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className='mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400'
                  placeholder='A story title'
                />
              </label>

              <label className='block text-sm text-slate-200'>
                Genre
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className='mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none transition focus:border-cyan-400'
                >
                  {GENRE_OPTIONS.map((option) => (
                    <option key={option} value={option} className='bg-slate-950 text-white'>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className='block text-sm text-slate-200'>
                Opening Line
                <textarea
                  value={openingLine}
                  onChange={(e) => setOpeningLine(e.target.value)}
                  required
                  maxLength={280}
                  rows={5}
                  className='mt-1 w-full rounded-3xl border border-cyan-400/20 bg-slate-950/90 px-5 py-4 text-xl font-semibold leading-7 text-white shadow-inner shadow-cyan-400/5 outline-none transition placeholder:text-slate-400 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20'
                  placeholder='The sentence that starts everything...'
                />
                <div className='mt-1 flex items-center justify-between text-xs text-slate-400'>
                  <span>This is the sentence that starts everything.</span>
                  <span>{openingLine.length}/280</span>
                </div>
              </label>

              <label className='block text-sm text-slate-200'>
                Max Writers
                <input
                  type='number'
                  value={maxWriters}
                  onChange={(e) => setMaxWriters(Number(e.target.value))}
                  min={3}
                  max={20}
                  required
                  className='mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400'
                />
              </label>

              <label className='block text-sm text-slate-200'>
                Plot Twists per Writer
                <input
                  type='number'
                  value={turnsPerWriter}
                  onChange={(e) => setTurnsPerWriter(Number(e.target.value))}
                  min={1}
                  max={5}
                  required
                  className='mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400'
                />
                <span className='mt-1 block text-xs text-slate-400'>How many choices each writer gets to make</span>
              </label>

              {error ? (
                <p className='rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100'>{error}</p>
              ) : null}

              <button
                type='submit'
                disabled={loading}
                className='w-full rounded-sm bg-[#e8d5b7] px-4 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#f0e3ce] disabled:cursor-not-allowed disabled:opacity-70'
              >
                {loading ? 'Creating...' : 'Create story'}
              </button>
            </form>
          </article>
        </div>
      </section>
    </main>
  );
}
