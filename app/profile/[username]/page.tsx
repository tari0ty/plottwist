import Link from 'next/link';
import { notFound } from 'next/navigation';
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
    default:
      return `${base} border-[#2a2a2a] bg-[#151515] text-[#f5f5f3]`;
  }
}

export default async function ProfilePage({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, username, bio, contact_link')
    .eq('username', username)
    .maybeSingle();

  if (profileError || !profile) {
    notFound();
  }

  const { data: participantRows } = await supabase
    .from('story_participants')
    .select('story_id')
    .eq('user_id', profile.id);

  const storyIds = (participantRows ?? [])
    .map((r: { story_id?: string | null }) => r.story_id)
    .filter((storyId): storyId is string => Boolean(storyId));

  let completedStories: Array<{ id: string; title: string; opening_line: string | null; genre: string | null; writer_count: number | null; max_writers: number | null; status: string | null; }> = [];
  if (storyIds.length > 0) {
    const { data: contributedStoriesData } = await supabase
      .from('stories')
      .select('id, title, opening_line, genre, writer_count, max_writers, status')
      .in('id', storyIds)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    completedStories = contributedStoriesData ?? [];
  }

  return (
    <main className='min-h-screen bg-[#0a0a0a] text-white'>
      <section className='mx-auto min-h-screen w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8'>
        <header className='mb-8 border border-[#222222] bg-[#111111] p-6'>
          <div className='flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between'>
            <div>
              <p className='text-sm uppercase tracking-[0.35em] text-[#e8d5b7]'>Profile</p>
              <h1 className='mt-3 font-serif text-4xl font-black tracking-tight text-white'>{profile.username}</h1>
              {profile.bio ? (
                <p className='mt-4 max-w-2xl text-sm leading-7 text-slate-300'>{profile.bio}</p>
              ) : (
                <p className='mt-4 max-w-2xl text-sm leading-7 text-slate-500'>This writer has not added a bio yet.</p>
              )}
            </div>

            {profile.contact_link ? (
              <a
                href={profile.contact_link}
                target='_blank'
                rel='noreferrer'
                className='inline-flex items-center justify-center rounded-sm bg-[#e8d5b7] px-5 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#f0e3ce]'
              >
                Get in touch
              </a>
            ) : null}
          </div>
        </header>

        <section className='space-y-4 border border-[#222222] bg-[#111111] p-6'>
          <div className='border-b border-[#222222] pb-3'>
            <h2 className='font-serif text-2xl font-semibold text-white'>Completed Stories</h2>
          </div>
          {completedStories.length > 0 ? (
            <div className='grid gap-4 md:grid-cols-2'>
              {completedStories.map((story) => {
                const theme = genreThemes[(story.genre || '').toLowerCase() as keyof typeof genreThemes] ?? genreThemes.default;

                return (
                  <Link
                    key={story.id}
                    href={`/story/${story.id}`}
                    className='block rounded-sm border p-5 transition hover:-translate-y-0.5'
                    style={{ borderColor: theme.accent, backgroundColor: `${theme.accent}15` }}
                  >
                    <div className='flex items-center justify-between gap-3'>
                      <h3 className='font-serif text-lg font-semibold text-white'>{story.title}</h3>
                      <span className={badgeClass(story.genre)} style={{ color: theme.accentText }}>{story.genre || 'General'}</span>
                    </div>
                    <p className='mt-3 text-sm text-[#bdbdb7]'>{story.opening_line || 'No opening line available.'}</p>
                    <div className='mt-4 flex flex-wrap gap-2 text-xs text-[#888888]'>
                      <span className='rounded-sm border border-[#2a2a2a] bg-[#151515] px-3 py-1.5'>
                        {story.writer_count ?? 0}/{story.max_writers ?? 0} writers
                      </span>
                      <span className='rounded-sm border border-[#2a2a2a] bg-[#151515] px-3 py-1.5 text-[#e8d5b7]'>Completed</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p className='rounded-sm border border-[#222222] bg-[#111111] p-5 text-center text-sm italic text-[#888888]'>No completed contributed stories yet.</p>
          )}
        </section>
      </section>
    </main>
  );
}
