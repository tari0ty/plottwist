'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

export default function RemixForm({
  originalStoryId,
  userId,
}: {
  originalStoryId: string;
  userId: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [maxWriters, setMaxWriters] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Fetch the original story data
      const { data: originalStory, error: fetchError } = await supabase
        .from('stories')
        .select('id, title, opening_line, genre')
        .eq('id', originalStoryId)
        .single();

      if (fetchError || !originalStory) {
        setError('Could not fetch original story');
        setLoading(false);
        return;
      }

      // Create the remix story
      const { data: newStory, error: storyError } = await supabase
        .from('stories')
        .insert({
          title: `Remix of ${originalStory.title}`,
          opening_line: originalStory.opening_line,
          genre: originalStory.genre,
          author_id: userId,
          max_writers: maxWriters,
          writer_count: 1,
          status: 'active',
          is_remix: true,
          remixed_from: originalStoryId,
        })
        .select('id')
        .single();

      if (storyError || !newStory) {
        setError(storyError?.message || 'Could not create remix story');
        setLoading(false);
        return;
      }

      // Add current user as first participant
      const { error: participantError } = await supabase
        .from('story_participants')
        .insert({
          story_id: newStory.id,
          user_id: userId,
          turn_order: 1,
          has_taken_turn: false,
        });

      if (participantError) {
        setError(participantError.message);
        setLoading(false);
        return;
      }

      // Increment remix_count on original story
      const { error: updateError } = await supabase
        .rpc('increment_remix_count', { story_id: originalStoryId });

      if (updateError) {
        console.warn('Could not increment remix count:', updateError);
        // Continue anyway - this is not critical
      }

      router.push(`/story/${newStory.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setLoading(false);
    }
  };

  return (
    <article className='rounded-3xl border border-white/10 bg-[#0b1622] p-6 md:p-8'>
      <form onSubmit={handleSubmit} className='space-y-5'>
        <label className='block text-sm text-slate-200'>
          Max Writers
          <input
            type='number'
            value={maxWriters}
            onChange={(e) => setMaxWriters(parseInt(e.target.value))}
            min={3}
            max={20}
            required
            className='mt-1 w-full rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-3 text-white outline-none transition placeholder:text-slate-400 focus:border-cyan-400'
          />
          <p className='mt-1 text-xs text-slate-400'>Between 3 and 20 writers</p>
        </label>

        {error && (
          <div className='rounded-2xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-100'>
            {error}
          </div>
        )}

        <div className='flex gap-3 pt-4'>
          <button
            type='submit'
            disabled={loading}
            className='flex-1 rounded-full bg-cyan-400 px-6 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50 disabled:cursor-not-allowed'
          >
            {loading ? 'Starting Remix...' : 'Start Remix'}
          </button>

          <Link
            href={`/story/${originalStoryId}`}
            className='rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-400 hover:text-white'
          >
            Cancel
          </Link>
        </div>
      </form>
    </article>
  );
}
