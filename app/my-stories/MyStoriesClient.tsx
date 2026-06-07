'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

const genreThemes = {
  horror: { surface: '#110000', border: '#2a0000', accent: '#ff4444', accentText: '#ff8888' },
  romance: { surface: '#110010', border: '#2a0020', accent: '#f472b6', accentText: '#f9a8d4' },
  comedy: { surface: '#111100', border: '#2a2500', accent: '#facc15', accentText: '#fde68a' },
  surreal: { surface: '#0d0011', border: '#1a0030', accent: '#a855f7', accentText: '#d8b4fe' },
  adventure: { surface: '#001411', border: '#002a20', accent: '#34d399', accentText: '#6ee7b7' },
  thriller: { surface: '#110800', border: '#2a1500', accent: '#f97316', accentText: '#fdba74' },
  fantasy: { surface: '#000011', border: '#00002a', accent: '#818cf8', accentText: '#c7d2fe' },
  mystery: { surface: '#100e00', border: '#252000', accent: '#d97706', accentText: '#fcd34d' },
  default: { surface: '#111111', border: '#222222', accent: '#e8d5b7', accentText: '#e8d5b7' },
} as const;

type JoinedRecord<T> = T | T[] | null;

export interface StoryRecord {
  id: string;
  title: string | null;
  genre: string | null;
  status: string | null;
  writer_count: number | null;
  max_writers: number | null;
  author_id: string | null;
  turns_per_writer?: number | null;
  opening_line?: string | null;
}

export interface ParticipantStoryRecord {
  id: string;
  story_id: string | null;
  user_id: string | null;
  turn_order: number;
  has_taken_turn: boolean | null;
  stories?: JoinedRecord<StoryRecord>;
}

export interface JoinRequestRecord {
  id: string;
  story_id: string | null;
  user_id: string | null;
  status: string | null;
  created_at: string | null;
  profiles?: JoinedRecord<{ username?: string | null }>;
  stories?: JoinedRecord<StoryRecord>;
}

function getTheme(genre?: string | null) {
  return genreThemes[(genre || '').toLowerCase() as keyof typeof genreThemes] ?? genreThemes.default;
}

function unwrapJoined<T>(record: JoinedRecord<T> | undefined) {
  return Array.isArray(record) ? record[0] : record;
}

function statusLabel(status?: string | null) {
  switch (status) {
    case 'recruiting':
      return 'Recruiting';
    case 'active':
      return 'Active';
    case 'voting':
      return 'Voting';
    case 'completed':
      return 'Completed';
    default:
      return status || 'Unknown';
  }
}

function StoryCard({
  story,
  actionLabel = 'Open',
  urgent = false,
}: {
  story: StoryRecord;
  actionLabel?: string;
  urgent?: boolean;
}) {
  const theme = getTheme(story.genre);

  return (
    <Link
      href={`/story/${story.id}`}
      className='block rounded-sm border p-5 transition hover:-translate-y-0.5'
      style={{ borderColor: urgent ? theme.accent : theme.border, backgroundColor: urgent ? `${theme.accent}18` : theme.surface, borderWidth: urgent ? '2px' : '1px' }}
    >
      <div className='flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h3 className='font-serif text-xl font-semibold text-white'>{story.title ?? 'Untitled story'}</h3>
          {urgent ? <p className='mt-2 text-sm font-semibold' style={{ color: theme.accent }}>It&apos;s your turn - pick a plot twist</p> : null}
        </div>
        <span className='rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em]' style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.accentText }}>
          {story.genre || 'General'}
        </span>
      </div>

      <div className='mt-4 flex flex-wrap items-center gap-2 text-xs'>
        <span className='rounded-sm border px-3 py-1.5' style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.accentText }}>
          {story.writer_count ?? 0}/{story.max_writers ?? 0} writers
        </span>
        <span className='rounded-sm border px-3 py-1.5 font-semibold' style={{ borderColor: theme.accent, backgroundColor: `${theme.accent}22`, color: theme.accentText }}>
          {statusLabel(story.status)}
        </span>
        <span className='rounded-sm px-3 py-1.5 font-semibold' style={{ backgroundColor: theme.accent, color: '#111111' }}>
          {actionLabel}
        </span>
      </div>
    </Link>
  );
}

export default function MyStoriesClient({
  authoredStories,
  joinedStories,
  pendingRequests,
  yourTurnStories,
}: {
  authoredStories: StoryRecord[];
  joinedStories: StoryRecord[];
  pendingRequests: JoinRequestRecord[];
  yourTurnStories: StoryRecord[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [requests, setRequests] = useState(pendingRequests);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setRequestError = (requestId: string, message: string | null) => {
    setErrors((current) => {
      const next = { ...current };

      if (message) {
        next[requestId] = message;
      } else {
        delete next[requestId];
      }

      return next;
    });
  };

  const handleAccept = async (request: JoinRequestRecord) => {
    if (!request.story_id || !request.user_id) {
      setRequestError(request.id, 'This request is missing story or writer details.');
      return;
    }

    setBusyRequestId(request.id);
    setRequestError(request.id, null);

    try {
      const { error: updateRequestError } = await supabase
        .from('join_requests')
        .update({ status: 'accepted' })
        .eq('id', request.id);

      if (updateRequestError) {
        throw new Error(updateRequestError.message);
      }

      const { data: latestParticipants, error: participantsError } = await supabase
        .from('story_participants')
        .select('turn_order')
        .eq('story_id', request.story_id)
        .order('turn_order', { ascending: false })
        .limit(1);

      if (participantsError) {
        throw new Error(participantsError.message);
      }

      const nextTurnOrder = (latestParticipants?.[0]?.turn_order ?? 0) + 1;
      const { error: insertParticipantError } = await supabase
        .from('story_participants')
        .insert({
          story_id: request.story_id,
          user_id: request.user_id,
          turn_order: nextTurnOrder,
          has_taken_turn: false,
        });

      if (insertParticipantError) {
        throw new Error(insertParticipantError.message);
      }

      const story = unwrapJoined(request.stories);
      const nextWriterCount = (story?.writer_count ?? 0) + 1;
      const { error: updateStoryError } = await supabase
        .from('stories')
        .update({
          writer_count: nextWriterCount,
          milestone_locked: nextWriterCount >= (story?.max_writers ?? 0),
        })
        .eq('id', request.story_id);

      if (updateStoryError) {
        throw new Error(updateStoryError.message);
      }

      setRequests((current) => current.filter((entry) => entry.id !== request.id));
      router.refresh();
    } catch (error) {
      setRequestError(request.id, error instanceof Error ? error.message : 'Unable to accept this request.');
    } finally {
      setBusyRequestId(null);
    }
  };

  const handleDecline = async (request: JoinRequestRecord) => {
    setBusyRequestId(request.id);
    setRequestError(request.id, null);

    try {
      const { error: deleteError } = await supabase
        .from('join_requests')
        .delete()
        .eq('id', request.id);

      if (deleteError) {
        throw new Error(deleteError.message);
      }

      setRequests((current) => current.filter((entry) => entry.id !== request.id));
      router.refresh();
    } catch (error) {
      setRequestError(request.id, error instanceof Error ? error.message : 'Unable to decline this request.');
    } finally {
      setBusyRequestId(null);
    }
  };

  const groupedAuthoredStories = {
    Recruiting: authoredStories.filter((story) => story.status === 'recruiting'),
    Active: authoredStories.filter((story) => story.status === 'active' || story.status === 'voting'),
    Completed: authoredStories.filter((story) => story.status === 'completed'),
  };

  return (
    <div className='space-y-8'>
      <section className='space-y-4'>
        <div className='flex items-center justify-between gap-3'>
          <h2 className='font-serif text-2xl font-semibold text-white'>Your Turn</h2>
          <span className='rounded-sm border border-[#ff4444] bg-[#2a0000] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[#ff8888]'>{yourTurnStories.length} waiting</span>
        </div>
        {yourTurnStories.length > 0 ? (
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {yourTurnStories.map((story) => <StoryCard key={story.id} story={story} actionLabel='Pick Twist' urgent />)}
          </div>
        ) : (
          <p className='rounded-sm border border-[#222222] bg-[#111111] p-5 text-sm text-[#888888]'>No stories need your turn right now.</p>
        )}
      </section>

      <section className='space-y-5'>
        <h2 className='font-serif text-2xl font-semibold text-white'>Your Stories</h2>
        {Object.entries(groupedAuthoredStories).map(([groupName, stories]) => (
          <section key={groupName} className='space-y-3'>
            <div className='flex items-center justify-between border-b border-[#222222] pb-2'>
              <h3 className='text-sm font-semibold uppercase tracking-[0.25em] text-[#e8d5b7]'>{groupName}</h3>
              <span className='text-xs text-[#888888]'>{stories.length}</span>
            </div>
            {stories.length > 0 ? (
              <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
                {stories.map((story) => <StoryCard key={story.id} story={story} actionLabel='Manage' />)}
              </div>
            ) : (
              <p className='rounded-sm border border-[#222222] bg-[#111111] p-4 text-sm text-[#888888]'>No {groupName.toLowerCase()} stories.</p>
            )}
          </section>
        ))}
      </section>

      <section className='space-y-4'>
        <div className='flex items-center justify-between gap-3'>
          <h2 className='font-serif text-2xl font-semibold text-white'>Pending Requests</h2>
          <span className='rounded-sm border border-[#2a2a2a] bg-[#151515] px-3 py-1 text-xs uppercase tracking-[0.2em] text-[#e8d5b7]'>{requests.length} waiting</span>
        </div>
        {requests.length > 0 ? (
          <div className='space-y-3'>
            {requests.map((request) => {
              const story = unwrapJoined(request.stories);
              const profile = unwrapJoined(request.profiles);
              const theme = getTheme(story?.genre);
              const isBusy = busyRequestId === request.id;

              return (
                <article key={request.id} className='rounded-sm border p-4' style={{ borderColor: theme.border, backgroundColor: theme.surface }}>
                  <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
                    <div>
                      <p className='text-sm text-[#f5f5f3]'>
                        <span className='font-semibold'>{profile?.username ?? 'Unknown writer'}</span>
                        {' '}wants to join{' '}
                        <Link href={`/story/${story?.id ?? request.story_id}`} className='font-semibold hover:underline' style={{ color: theme.accent }}>
                          {story?.title ?? 'Untitled story'}
                        </Link>
                      </p>
                      <span className='mt-2 inline-flex rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em]' style={{ borderColor: theme.border, backgroundColor: `${theme.accent}15`, color: theme.accentText }}>
                        {story?.genre || 'General'}
                      </span>
                      {errors[request.id] ? <p className='mt-3 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100'>{errors[request.id]}</p> : null}
                    </div>
                    <div className='flex flex-wrap gap-3'>
                      <button
                        type='button'
                        onClick={() => handleAccept(request)}
                        disabled={isBusy}
                        className='rounded-sm px-4 py-2 text-sm font-semibold text-[#111111] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60'
                        style={{ backgroundColor: theme.accent }}
                      >
                        {isBusy ? 'Working...' : 'Accept'}
                      </button>
                      <button
                        type='button'
                        onClick={() => handleDecline(request)}
                        disabled={isBusy}
                        className='rounded-sm border border-[#2a2a2a] bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#161616] disabled:cursor-not-allowed disabled:opacity-60'
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <p className='rounded-sm border border-[#222222] bg-[#111111] p-5 text-sm text-[#888888]'>No pending requests right now.</p>
        )}
      </section>

      <section className='space-y-4'>
        <h2 className='font-serif text-2xl font-semibold text-white'>Stories Joined</h2>
        {joinedStories.length > 0 ? (
          <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
            {joinedStories.map((story) => <StoryCard key={story.id} story={story} actionLabel='Read' />)}
          </div>
        ) : (
          <p className='rounded-sm border border-[#222222] bg-[#111111] p-5 text-sm text-[#888888]'>You have not joined any stories yet.</p>
        )}
      </section>
    </div>
  );
}
