'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/utils/supabase/client';

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

type JoinedRecord<T> = T | T[] | null;

interface ProfileRecord {
  username?: string | null;
}

interface StoryRecord {
  title?: string | null;
  genre?: string | null;
  author_id?: string | null;
}

export interface JoinRequestRecord {
  id: string;
  story_id: string | null;
  user_id: string | null;
  status: string | null;
  created_at: string | null;
  profiles?: JoinedRecord<ProfileRecord>;
  stories?: JoinedRecord<StoryRecord>;
}

export default function RequestsClient({ initialRequests }: { initialRequests: JoinRequestRecord[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [requests, setRequests] = useState(initialRequests);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const visibleRequests = requests.filter((entry) => entry.status === 'pending' || entry.status === 'accepted');
  const pendingRequests = requests.filter((entry) => entry.status === 'pending');
  const acceptedRequests = requests.filter((entry) => entry.status === 'accepted');

  const groupByStory = (items: JoinRequestRecord[]) => {
    const grouped = new Map<string, JoinRequestRecord[]>();

    items.forEach((item) => {
      const key = item.story_id ?? 'unknown';
      const existing = grouped.get(key) ?? [];
      existing.push(item);
      grouped.set(key, existing);
    });

    return grouped;
  };

  const visibleGroups = groupByStory(visibleRequests);
  const acceptedGroups = groupByStory(acceptedRequests);

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

      const { data: story, error: storyError } = await supabase
        .from('stories')
        .select('writer_count, max_writers')
        .eq('id', request.story_id)
        .single();

      if (storyError || !story) {
        throw new Error(storyError?.message ?? 'Could not load story writer counts.');
      }

      const nextWriterCount = (story.writer_count ?? 0) + 1;
      const shouldLock = nextWriterCount >= (story.max_writers ?? 0);
      const { error: updateStoryError } = await supabase
        .from('stories')
        .update({
          writer_count: nextWriterCount,
          milestone_locked: shouldLock,
        })
        .eq('id', request.story_id);

      if (updateStoryError) {
        throw new Error(updateStoryError.message);
      }

      setRequests((current) => current.map((entry) => (entry.id === request.id ? { ...entry, status: 'accepted' } : entry)));
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

  return (
    <section className='space-y-8'>
      <article className='space-y-6'>
        <div className='flex items-center justify-between gap-4'>
          <h2 className='font-serif text-2xl font-semibold text-white'>Pending requests</h2>
          <span className='rounded-sm border border-[#2a2a2a] bg-[#151515] px-3 py-1 text-xs uppercase tracking-[0.25em] text-[#e8d5b7]'>{pendingRequests.length} waiting</span>
        </div>

        {visibleGroups.size > 0 ? (
          <div className='space-y-6'>
            {Array.from(visibleGroups.entries()).map(([storyId, items]) => {
              const story = Array.isArray(items[0]?.stories) ? items[0].stories[0] : items[0]?.stories;
              const theme = genreThemes[(story?.genre || '').toLowerCase() as keyof typeof genreThemes] ?? genreThemes.default;

              return (
                <section key={storyId} className='rounded-sm border p-5' style={{ backgroundColor: theme.surface, borderColor: theme.border, borderWidth: '2px' }}>
                  <div className='mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4'>
                    <div>
                      <p className='text-xs uppercase tracking-[0.35em]' style={{ color: theme.accent }}>Story</p>
                      <h3 className='mt-2 font-serif text-2xl font-semibold text-white'>{story?.title ?? 'Untitled story'}</h3>
                    </div>
                    <span className='rounded-sm border px-2.5 py-1 text-[11px] uppercase tracking-[0.2em]' style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.accentText }}>
                      {story?.genre || 'General'}
                    </span>
                  </div>

                  <div className='space-y-3'>
                    {items.map((request) => {
                      const requester = Array.isArray(request.profiles) ? request.profiles[0] : request.profiles;
                      const isBusy = busyRequestId === request.id;

                      return (
                        <article key={request.id} className='rounded-sm border p-4' style={{ backgroundColor: `${theme.accent}15`, borderColor: theme.border }}>
                          <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
                            <div>
                              <p className='text-sm text-[#f5f5f3]'>
                                <Link href={`/profile/${requester?.username ?? 'profile'}`} className='font-semibold text-white hover:text-[#e8d5b7]'>
                                  {requester?.username ?? 'Unknown writer'}
                                </Link>
                                {request.status === 'accepted' ? ' joined this story.' : ' wants to join this story.'}
                              </p>
                              <p className='mt-1 text-xs uppercase tracking-[0.25em] text-[#bdbdb7]'>Requested {new Date(request.created_at ?? '').toLocaleDateString()}</p>
                              {errors[request.id] ? (
                                <p className='mt-3 rounded-sm border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-100'>{errors[request.id]}</p>
                              ) : null}
                            </div>
                            <div className='flex flex-wrap gap-3'>
                              {request.status === 'accepted' ? (
                                <span className='rounded-sm border px-4 py-2 text-sm font-semibold' style={{ borderColor: theme.accent, backgroundColor: `${theme.accent}22`, color: theme.accentText }}>
                                  Accepted
                                </span>
                              ) : (
                                <>
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
                                </>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <p className='rounded-sm border border-[#222222] bg-[#111111] p-5 text-sm text-[#888888]'>No pending join requests right now.</p>
        )}
      </article>

      <article className='grid gap-6 md:grid-cols-2'>
        <section className='rounded-sm border border-[#222222] bg-[#111111] p-6'>
          <h2 className='font-serif text-2xl font-semibold text-white'>Accepted requests</h2>
          {acceptedGroups.size > 0 ? (
            <div className='mt-4 space-y-4'>
              {Array.from(acceptedGroups.entries()).map(([storyId, items]) => {
                const story = Array.isArray(items[0]?.stories) ? items[0].stories[0] : items[0]?.stories;

                return (
                  <article key={storyId} className='rounded-sm border border-[#2a2a2a] bg-[#151515] p-4'>
                    <p className='text-sm font-semibold text-white'>{story?.title ?? 'Untitled story'}</p>
                    <p className='mt-1 text-sm text-[#bdbdb7]'>{items.length} writer{items.length === 1 ? '' : 's'} accepted.</p>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className='mt-4 text-sm text-[#888888]'>No accepted requests yet.</p>
          )}
        </section>
      </article>
    </section>
  );
}
