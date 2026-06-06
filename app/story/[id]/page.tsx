import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import Navbar from '@/components/Navbar';
import StoryClient from './StoryClient';

const genreThemes = {
  horror: {
    bg: '#0a0000',
    surface: '#110000',
    border: '#2a0000',
    accent: '#ff4444',
    accentText: '#ff8888',
    badge: 'border-red-900 bg-red-950 text-red-300',
    gradient: 'from-red-950/20 to-transparent',
  },
  romance: {
    bg: '#0a0008',
    surface: '#110010',
    border: '#2a0020',
    accent: '#f472b6',
    accentText: '#f9a8d4',
    badge: 'border-pink-900 bg-pink-950 text-pink-300',
    gradient: 'from-pink-950/20 to-transparent',
  },
  comedy: {
    bg: '#0a0900',
    surface: '#111100',
    border: '#2a2500',
    accent: '#facc15',
    accentText: '#fde68a',
    badge: 'border-yellow-900 bg-yellow-950 text-yellow-300',
    gradient: 'from-yellow-950/20 to-transparent',
  },
  surreal: {
    bg: '#05000a',
    surface: '#0d0011',
    border: '#1a0030',
    accent: '#a855f7',
    accentText: '#d8b4fe',
    badge: 'border-violet-900 bg-violet-950 text-violet-300',
    gradient: 'from-violet-950/20 to-transparent',
  },
  adventure: {
    bg: '#00080a',
    surface: '#001411',
    border: '#002a20',
    accent: '#34d399',
    accentText: '#6ee7b7',
    badge: 'border-green-900 bg-green-950 text-green-300',
    gradient: 'from-green-950/20 to-transparent',
  },
  thriller: {
    bg: '#0a0400',
    surface: '#110800',
    border: '#2a1500',
    accent: '#f97316',
    accentText: '#fdba74',
    badge: 'border-orange-900 bg-orange-950 text-orange-300',
    gradient: 'from-orange-950/20 to-transparent',
  },
  fantasy: {
    bg: '#00000a',
    surface: '#000011',
    border: '#00002a',
    accent: '#818cf8',
    accentText: '#c7d2fe',
    badge: 'border-indigo-900 bg-indigo-950 text-indigo-300',
    gradient: 'from-indigo-950/20 to-transparent',
  },
  mystery: {
    bg: '#080600',
    surface: '#100e00',
    border: '#252000',
    accent: '#d97706',
    accentText: '#fcd34d',
    badge: 'border-amber-900 bg-amber-950 text-amber-300',
    gradient: 'from-amber-950/20 to-transparent',
  },
  default: {
    bg: '#0a0a0a',
    surface: '#111111',
    border: '#222222',
    accent: '#e8d5b7',
    accentText: '#e8d5b7',
    badge: 'border-zinc-700 bg-zinc-900 text-zinc-300',
    gradient: 'from-zinc-900/20 to-transparent',
  },
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
    case 'horror':
      return `${base} border-[#2a2a2a] bg-[#151515] text-[#e8d5b7]`;
    default:
      return `${base} border-[#2a2a2a] bg-[#151515] text-[#f5f5f3]`;
  }
}

export default async function StoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: storyData, error: storyError } = await supabase
    .from('stories')
    .select('*, profiles(username)')
    .eq('id', id)
    .single();

  if (storyError || !storyData) {
    notFound();
  }

  await supabase
    .from('stories')
    .update({ views: (storyData.views ?? 0) + 1 })
    .eq('id', id);

  const { data: turnsData } = await supabase
    .from('turns')
    .select('*, story_participants(*, profiles(username))')
    .eq('story_id', id)
    .order('turn_number', { ascending: true });

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  const { count: likeCount } = await supabase
    .from('likes')
    .select('*', { count: 'exact', head: true })
    .eq('story_id', id);

  const { data: userLike } = user
    ? await supabase
        .from('likes')
        .select('id')
        .eq('story_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  const { data: participantData } = user
    ? await supabase
        .from('story_participants')
        .select('id, turn_order, has_taken_turn')
        .eq('story_id', id)
        .eq('user_id', user.id)
        .maybeSingle()
    : { data: null };

  const { data: allParticipants } = await supabase
    .from('story_participants')
    .select('id, turn_order, has_taken_turn, user_id, profiles(username)')
    .eq('story_id', id)
    .order('turn_order', { ascending: true });

  const turnsTakenByParticipant = (turnsData ?? []).reduce<Record<string, number>>((acc, turn) => {
    const participantId = turn.participant_id ?? null;
    if (participantId) {
      acc[participantId] = (acc[participantId] ?? 0) + 1;
    }
    return acc;
  }, {});

  const currentTurn = (turnsData?.length ?? 0) + 1;
  const nextParticipant = (allParticipants ?? [])
    .filter((entry) => (turnsTakenByParticipant[entry.id] ?? 0) < (storyData.turns_per_writer ?? 1))
    .sort((left, right) => {
      const leftTurns = turnsTakenByParticipant[left.id] ?? 0;
      const rightTurns = turnsTakenByParticipant[right.id] ?? 0;
      return leftTurns - rightTurns || left.turn_order - right.turn_order;
    })[0] ?? null;

  const theme = genreThemes[(storyData.genre || '').toLowerCase() as keyof typeof genreThemes] ?? genreThemes.default;

  const canJoin = Boolean(
    user &&
      !participantData &&
      (allParticipants?.length ?? 0) < (storyData.max_writers ?? 0),
  );

  const authorName = storyData.profiles?.username ?? 'Unknown author';
  const currentParticipantTurnCount = nextParticipant ? (turnsTakenByParticipant[nextParticipant.id] ?? 0) : 0;
  const currentUsername = nextParticipant?.profiles?.[0]?.username ?? 'Someone';
  const storyForClient = {
    id: storyData.id,
    title: storyData.title,
    writer_count: storyData.writer_count ?? 0,
    max_writers: storyData.max_writers ?? 0,
    turns_per_writer: storyData.turns_per_writer ?? 1,
  };

  return (
    <main className='min-h-screen text-white' style={{ backgroundColor: theme.bg }}>
      <section className='mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8'>
        <Navbar />
        <article
          className='border p-6 md:p-8'
          style={{ backgroundColor: theme.surface, borderColor: theme.border }}
        >
          <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
            <div className='space-y-3'>
              <p className='text-sm uppercase tracking-[0.35em]' style={{ color: theme.accent }}>Now reading</p>
              <h1 className='font-serif text-4xl font-black tracking-tight text-white md:text-5xl'>{storyData.title}</h1>
              <div className='flex flex-wrap items-center gap-2 text-sm text-slate-200'>
                <span className={badgeClass(storyData.genre)} style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.accentText }}>{storyData.genre || 'General'}</span>
                <span className='rounded-full border border-white/10 bg-white/6 px-3 py-1.5'>by {authorName}</span>
                <span className='rounded-full border border-white/10 bg-white/6 px-3 py-1.5'>
                  {storyData.writer_count ?? 0}/{storyData.max_writers ?? 0} writers
                </span>
                {(storyData.views ?? 0) > 0 ? (
                  <span className='rounded-sm border px-3 py-1.5' style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.accent }}>
                    👁 {storyData.views} views
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </article>

        <section className='mt-8 grid gap-8 lg:grid-cols-[1.1fr_0.9fr]'>
          <article className='space-y-6'>
            <div
              className='border p-5'
              style={{ backgroundColor: `${theme.accent}15`, borderColor: theme.accent, borderWidth: '2px' }}
            >
              <p className='text-xs uppercase tracking-[0.35em]' style={{ color: theme.accent }}>The Beginning</p>
              <p className='mt-3 text-base leading-7 text-slate-100'>{storyData.opening_line}</p>
            </div>

            <div className='space-y-4'>
              {turnsData?.map((turn) => (
                <article
                  key={turn.id}
                  className='border p-5'
                  style={{ backgroundColor: `${theme.accent}15`, borderColor: theme.accent, borderWidth: '2px' }}
                >
                  <div className='mb-3 flex items-center justify-between gap-3'>
                    <p className='text-xs uppercase tracking-[0.35em]' style={{ color: theme.accent }}>Plot {turn.turn_number}</p>
                    <span className='text-sm text-[#bdbdb7]'>by {turn.story_participants?.profiles?.username ?? 'Unknown'}</span>
                  </div>
                  <p className='text-base leading-7 text-slate-100'>{turn.chosen_text}</p>
                </article>
              ))}
            </div>
          </article>

          <aside className='space-y-6'>
            <StoryClient
              storyId={id}
              story={storyForClient}
              turns={turnsData ?? []}
              initialCanJoin={canJoin}
              initialCurrentTurn={currentTurn}
              initialCurrentParticipantId={nextParticipant?.user_id ?? null}
              currentUsername={currentUsername}
              turnsPerWriter={storyData.turns_per_writer ?? 1}
              currentParticipantTurnCount={currentParticipantTurnCount}
              initialLikeCount={likeCount ?? 0}
              initialUserLiked={!!userLike}
              theme={theme}
            />

            <article className='border p-6' style={{ backgroundColor: theme.surface, borderColor: theme.border }}>
              <p className='text-xs uppercase tracking-[0.35em]' style={{ color: theme.accent }}>Remix</p>
              <h3 className='mt-2 font-serif text-2xl font-semibold text-white'>Remix this story</h3>
              <p className='mt-3 text-sm text-[#888888]'>Take this story in a new direction and create a fresh branch from the current path.</p>
              <Link
                href={`/remix/${id}`}
                className='mt-4 inline-flex rounded-sm px-5 py-3 text-sm font-semibold transition hover:opacity-90'
                style={{ backgroundColor: theme.accent, color: theme.bg }}
              >
                Remix this story
              </Link>
            </article>
          </aside>
        </section>
      </section>
    </main>
  );
}
