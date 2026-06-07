import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';

const genreThemes = {
  horror: { bg: '#0a0000', surface: '#110000', border: '#2a0000', accent: '#ff4444', accentText: '#ff8888' },
  romance: { bg: '#0a0008', surface: '#110010', border: '#2a0020', accent: '#f472b6', accentText: '#f9a8d4' },
  comedy: { bg: '#0a0900', surface: '#111100', border: '#2a2500', accent: '#facc15', accentText: '#fde68a' },
  surreal: { bg: '#05000a', surface: '#0d0011', border: '#1a0030', accent: '#a855f7', accentText: '#d8b4fe' },
  adventure: { bg: '#00080a', surface: '#001411', border: '#002a20', accent: '#34d399', accentText: '#6ee7b7' },
  thriller: { bg: '#0a0400', surface: '#110800', border: '#2a1500', accent: '#f97316', accentText: '#fdba74' },
  fantasy: { bg: '#00000a', surface: '#000011', border: '#00002a', accent: '#818cf8', accentText: '#c7d2fe' },
  mystery: { bg: '#080600', surface: '#100e00', border: '#252000', accent: '#d97706', accentText: '#fcd34d' },
  default: { bg: '#0a0a0a', surface: '#111111', border: '#222222', accent: '#e8d5b7', accentText: '#e8d5b7' },
} as const;

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

export default async function CompletedPage() {
  const supabase = await createClient();

  // Fetch all completed stories with author info
  const { data: completedStories } = await supabase
    .from('stories')
    .select('id, title, opening_line, genre, author_id, status, remix_count, views, profiles(username)')
    .eq('status', 'completed')
    .order('created_at', { ascending: false });

  // For each story, fetch all turns with contributor info
  const storiesWithTurns = await Promise.all(
    (completedStories ?? []).map(async (story) => {
      const { data: turns } = await supabase
        .from('turns')
        .select('id, turn_number, chosen_text, story_participants(user_id, profiles(username))')
        .eq('story_id', story.id)
        .order('turn_number', { ascending: true });

      return {
        ...story,
        turns: turns ?? [],
      };
    })
  );

  return (
    <main className='min-h-screen bg-[#0a0a0a] text-white'>
      <section className='mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8'>
        <header className='mb-8'>
          <div className='border border-[#222222] bg-[#111111] p-6'>
            <p className='text-sm uppercase tracking-[0.35em] text-[#e8d5b7]'>Hall of Fame</p>
            <h1 className='mt-3 font-serif text-4xl font-black tracking-tight text-white md:text-5xl'>Completed Stories</h1>
            <p className='mt-4 max-w-2xl text-slate-300'>
              The greatest collaborative stories, fully written and ready to be explored. Read the complete journeys that our community has crafted together.
            </p>
          </div>
        </header>

        {!completedStories || completedStories.length === 0 ? (
          <article className='border border-dashed border-[#2a2a2a] bg-[#111111] p-10 text-center text-[#bdbdb7]'>
            <p className='text-lg'>No completed stories yet — go finish one!</p>
            <Link
              href='/create'
              className='mt-4 inline-flex rounded-sm bg-[#e8d5b7] px-6 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#f0e3ce]'
            >
              Start a Story
            </Link>
          </article>
        ) : (
          <section className='space-y-6'>
            {storiesWithTurns.map((story) => {
              const authorName = (story.profiles as { username?: string | null } | null)?.username ?? 'Unknown author';
              const theme = genreThemes[(story.genre || '').toLowerCase() as keyof typeof genreThemes] ?? genreThemes.default;

              return (
                <article
                  key={story.id}
                  className='border p-8'
                  style={{ borderColor: theme.accent, backgroundColor: `${theme.accent}15` }}
                >
                  {/* Header */}
                  <div className='mb-6 flex items-start justify-between gap-4'>
                    <div className='space-y-3'>
                      <div className='flex items-center gap-3'>
                        <span className='inline-flex rounded-sm border border-[#2a2a2a] bg-[#151515] px-3 py-1.5 text-xs font-semibold text-[#e8d5b7]'>
                          Completed Story
                        </span>
                        <span className={badgeClass(story.genre)} style={{ color: theme.accentText }}>{story.genre || 'General'}</span>
                      </div>
                      <h2 className='text-3xl font-black text-white'>{story.title}</h2>
                      <Link
                        href={`/profile/${authorName}`}
                        className='inline-flex text-sm font-semibold text-[#e8d5b7] transition hover:text-[#f0e3ce]'
                      >
                        by {authorName}
                      </Link>
                    </div>

                    <div className='flex flex-wrap items-center gap-2'>
                      {(story.views ?? 0) > 0 ? (
                        <div className='rounded-sm border border-[#2a2a2a] bg-[#151515] px-4 py-3 text-center'>
                          <p className='text-2xl font-black text-[#f5f5f3]'>{story.views}</p>
                          <p className='text-xs text-[#e8d5b7]'>views</p>
                        </div>
                      ) : null}
                      {(story.remix_count ?? 0) > 0 && (
                        <div className='rounded-sm border border-[#2a2a2a] bg-[#151515] px-4 py-3 text-center'>
                          <p className='text-2xl font-black text-[#f5f5f3]'>{story.remix_count}</p>
                          <p className='text-xs text-[#e8d5b7]'>remix{story.remix_count !== 1 ? 'es' : ''}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Story Timeline */}
                  <div className='mb-8 space-y-6 border-l-2 border-[#2a2a2a] pl-6'>
                    {/* Opening Line */}
                    <div className='space-y-2'>
                      <p className='text-xs uppercase tracking-[0.2em] text-slate-400'>Opening Line</p>
                      <p className='text-lg leading-7 text-slate-100'>{story.opening_line}</p>
                    </div>

                    {/* Turns */}
                    {story.turns.map((turn) => {
                      const contributor = (turn.story_participants as { profiles?: { username?: string | null } } | null)?.profiles?.username ?? 'Unknown contributor';

                      return (
                        <div key={turn.id} className='space-y-2'>
                          <p className='text-xs font-semibold text-[#e8d5b7]'>
                            Turn {turn.turn_number} — {contributor}
                          </p>
                          <p className='text-base leading-7 text-slate-100'>{turn.chosen_text}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className='flex gap-3'>
                    <Link
                      href={`/story/${story.id}`}
                      className='rounded-sm bg-[#e8d5b7] px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#0a0a0a] transition hover:opacity-90'
                    >
                      View Story
                    </Link>
                    <Link
                      href={`/remix/${story.id}`}
                      className='rounded-sm bg-[#e8d5b7] px-6 py-3 text-xs font-bold uppercase tracking-[0.2em] text-[#0a0a0a] transition hover:opacity-90'
                    >
                      Remix This Story
                    </Link>
                  </div>
                </article>
              );
            })}
          </section>
        )}
      </section>
    </main>
  );
}
