import Link from 'next/link';
import { createClient } from '@/utils/supabase/server';

function truncate(text: string, length = 100) {
  return text.length > length ? `${text.slice(0, length).trimEnd()}…` : text;
}

function getGenreTheme(genre?: string | null) {
  switch ((genre || '').toLowerCase()) {
    case 'horror':
      return { border: '#2a0000', bg: '#110000', accent: '#ff4444', text: '#ff8888' };
    case 'romance':
      return { border: '#2a0020', bg: '#110010', accent: '#f472b6', text: '#f9a8d4' };
    case 'comedy':
      return { border: '#2a2500', bg: '#111100', accent: '#facc15', text: '#fde68a' };
    case 'surreal':
      return { border: '#1a0030', bg: '#0d0011', accent: '#a855f7', text: '#d8b4fe' };
    case 'adventure':
      return { border: '#002a20', bg: '#001411', accent: '#34d399', text: '#6ee7b7' };
    case 'thriller':
      return { border: '#2a1500', bg: '#110800', accent: '#f97316', text: '#fdba74' };
    case 'fantasy':
      return { border: '#00002a', bg: '#000011', accent: '#818cf8', text: '#c7d2fe' };
    case 'mystery':
      return { border: '#252000', bg: '#100e00', accent: '#d97706', text: '#fcd34d' };
    default:
      return { border: '#222222', bg: '#111111', accent: '#e8d5b7', text: '#e8d5b7' };
  }
}

function getStatusBadge(status?: string | null, accent?: string) {
  switch (status) {
    case 'recruiting':
      return {
        label: 'Looking for Writers',
        border: accent ?? '#e8d5b7',
        bg: `${accent ?? '#e8d5b7'}22`,
        color: accent ?? '#e8d5b7',
      };
    case 'active':
      return {
        label: 'In Progress',
        border: '#64748b',
        bg: '#0f172a',
        color: '#cbd5e1',
      };
    case 'voting':
      return {
        label: 'Choose the Ending',
        border: '#facc15',
        bg: '#422006',
        color: '#fde68a',
      };
    case 'completed':
      return {
        label: 'Completed',
        border: '#52525b',
        bg: '#18181b',
        color: '#d4d4d8',
      };
    default:
      return null;
  }
}

export default async function HomePage() {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  const { data: profileData } = user
    ? await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
    : { data: null };

  const { data: stories } = await supabase
    .from('stories')
    .select('*, profiles(username)')
    .order('created_at', { ascending: false });

  const storiesWithLikes = await Promise.all(
    (stories ?? []).map(async (story) => {
      const { count } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('story_id', story.id);

      return {
        ...story,
        likes_count: count ?? 0,
      };
    }),
  );

  return (
    <main className='min-h-screen bg-[#0a0a0a] text-white'>
      <section className='mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8'>

        <section className='mb-8 flex flex-col gap-4 border border-[#222222] bg-[#111111] p-6'>
          <p className='text-sm uppercase tracking-[0.35em] text-[#e8d5b7]'>Live story feed</p>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between'>
            <div>
              <h1 className='max-w-2xl font-serif text-4xl font-black tracking-tight text-white md:text-6xl'>PlotTwist is where the next turn begins.</h1>
              <p className='mt-3 max-w-2xl text-[#bdbdb7]'>Browse fresh collaborative stories, spot the ones that are almost done, and enter the worlds your community is building.</p>
            </div>
            <div className='rounded-sm border border-[#2a2a2a] bg-[#151515] px-4 py-3 text-sm text-[#e8d5b7]'>
              {stories?.length ?? 0} stories currently live
            </div>
          </div>
        </section>

        {!storiesWithLikes || storiesWithLikes.length === 0 ? (
          <article className='border border-dashed border-[#2a2a2a] bg-[#111111] p-10 text-center text-[#bdbdb7]'>
            No stories are available yet. Start the first one and bring the feed to life.
          </article>
        ) : (
          <section className='grid gap-6 md:grid-cols-2 xl:grid-cols-3'>
            {storiesWithLikes.map((story) => {
              const authorName = story.profiles?.username ?? 'Unknown author';
              const openingLine = truncate(story.opening_line || story.title || 'A story begins here.', 100);
              const theme = getGenreTheme(story.genre);
              const statusBadge = getStatusBadge(story.status, theme.accent);

              return (
                <Link
                  key={story.id}
                  href={`/story/${story.id}`}
                  className='group border p-5 transition hover:-translate-y-0.5'
                  style={{ borderColor: theme.border, backgroundColor: theme.bg }}
                >
                  <article className='flex h-full flex-col gap-4'>
                    <div className='flex items-start justify-between gap-3'>
                      <div className='space-y-2'>
                        <p className='text-xs uppercase tracking-[0.3em]' style={{ color: theme.accent }}>Story</p>
                        <h2 className='text-xl font-bold text-white'>{story.title}</h2>
                      </div>
                      <span
                        className='rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em]'
                        style={{ borderColor: theme.border, backgroundColor: theme.bg, color: theme.text }}
                      >
                        {story.genre || 'General'}
                      </span>
                    </div>

                    <p className='text-sm' style={{ color: `${theme.text}cc` }}>{openingLine}</p>

                    <div className='mt-auto flex flex-wrap items-center gap-2 text-xs text-slate-200'>
                      <span className='rounded-sm border px-3 py-1.5 font-semibold' style={{ borderColor: theme.border, backgroundColor: theme.bg, color: theme.text }}>
                        by {authorName}
                      </span>
                      <span className='rounded-sm border px-3 py-1.5' style={{ borderColor: theme.border, backgroundColor: theme.bg, color: theme.text }}>
                        {story.writer_count ?? 0}/{story.max_writers ?? 0} writers
                      </span>
                      {(story.views ?? 0) > 0 ? (
                        <span className='rounded-sm border px-3 py-1.5' style={{ borderColor: theme.border, backgroundColor: theme.bg, color: theme.text }}>
                          👁 {story.views} views
                        </span>
                      ) : null}
                      {(story.likes_count ?? 0) > 0 ? (
                        <span className='rounded-sm border px-3 py-1.5' style={{ borderColor: theme.border, backgroundColor: theme.bg, color: theme.text }}>
                          ❤️ {story.likes_count} likes
                        </span>
                      ) : null}
                      {statusBadge ? (
                        <span className='rounded-sm border px-3 py-1.5 font-semibold' style={{ borderColor: statusBadge.border, backgroundColor: statusBadge.bg, color: statusBadge.color }}>
                          {statusBadge.label}
                        </span>
                      ) : null}
                      {(story.remix_count ?? 0) > 0 ? (
                        <span className='rounded-sm border px-3 py-1.5' style={{ borderColor: theme.border, backgroundColor: theme.bg, color: theme.text }}>
                          {story.remix_count} remixes
                        </span>
                      ) : null}
                    </div>
                  </article>
                </Link>
              );
            })}
          </section>
        )}
      </section>
    </main>
  );
}
