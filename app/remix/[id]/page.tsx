import { redirect } from 'next/navigation';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import RemixForm from './RemixForm';

function badgeClass(genre?: string | null) {
  const base = 'rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em]';
  switch ((genre || '').toLowerCase()) {
    case 'fantasy':
      return `${base} border-[#2a2a2a] bg-[#151515] text-[#e8d5b7]`;
    case 'romance':
      return `${base} border-[#2a2a2a] bg-[#151515] text-[#f5f5f3]`;
    case 'mystery':
      return `${base} border-[#2a2a2a] bg-[#151515] text-[#e8d5b7]`;
    case 'sci-fi':
    case 'scifi':
      return `${base} border-[#2a2a2a] bg-[#151515] text-[#e8d5b7]`;
    case 'horror':
      return `${base} border-[#2a2a2a] bg-[#151515] text-[#e8d5b7]`;
    case 'comedy':
      return `${base} border-[#2a2a2a] bg-[#151515] text-[#f5f5f3]`;
    default:
      return `${base} border-[#2a2a2a] bg-[#151515] text-[#f5f5f3]`;
  }
}

export default async function RemixPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Check if user is authenticated
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) {
    redirect('/login');
  }

  // Fetch the original story
  const { data: originalStory, error: storyError } = await supabase
    .from('stories')
    .select('id, title, opening_line, genre, author_id, profiles(username)')
    .eq('id', id)
    .single();

  if (storyError || !originalStory) {
    notFound();
  }

  const authorName = (originalStory.profiles as { username?: string | null } | null)?.username ?? 'Unknown author';

  return (
    <main className='min-h-screen bg-[#0a0a0a] text-white'>
      <section className='mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:px-8'>
        <header className='mb-8 flex items-center justify-between gap-3'>
          <Link href={`/story/${originalStory.id}`} className='text-sm font-semibold text-[#e8d5b7] hover:text-[#f0e3ce]'>
            ← Back to story
          </Link>
          <p className='text-sm uppercase tracking-[0.35em] text-[#e8d5b7]'>Remix</p>
        </header>

        <div className='grid gap-8 border border-[#222222] bg-[#111111] p-6 md:grid-cols-[1fr_1.05fr] md:p-10'>
          {/* Original Story Preview */}
          <article className='space-y-6 border border-[#222222] bg-[#151515] p-6 md:p-8'>
            <div className='space-y-4'>
              <p className='text-sm uppercase tracking-[0.3em] text-[#e8d5b7]'>Remixing</p>
              <h1 className='font-serif text-3xl font-black tracking-tight text-white md:text-4xl'>{originalStory.title}</h1>
              <span className={badgeClass(originalStory.genre)}>{originalStory.genre || 'General'}</span>
            </div>

            <div className='space-y-3'>
              <p className='text-xs uppercase tracking-[0.2em] text-slate-400'>Opening Line</p>
              <p className='rounded-sm border border-[#2a2a2a] bg-[#111111] p-4 text-base leading-6 text-[#f5f5f3]'>
                {originalStory.opening_line}
              </p>
            </div>

            <div className='space-y-2 pt-4 border-t border-white/10'>
              <p className='text-xs uppercase tracking-[0.2em] text-slate-400'>Original Author</p>
              <p className='text-sm font-medium text-white'>{authorName}</p>
            </div>

            <p className='text-sm text-slate-400 pt-4'>
              Create your own version of this story. Your remix will keep the opening line and genre, but you&apos;ll start a new collaboration with your own writers.
            </p>
          </article>

          {/* Remix Form */}
          <RemixForm originalStoryId={originalStory.id} userId={userData.user.id} />
        </div>
      </section>
    </main>
  );
}
