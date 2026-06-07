'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';

interface ForkOption {
  id?: string;
  content?: string;
  option_index?: number;
  was_chosen?: boolean;
}

interface StoryParticipant {
  id: string;
  user_id: string;
  turn_order: number;
  has_taken_turn: boolean;
}

interface StoryRecord {
  id: string;
  title: string;
  writer_count?: number;
  max_writers?: number;
  turns_per_writer?: number;
  [key: string]: unknown;
}

interface TurnRecord {
  id: string;
  turn_number: number;
  chosen_text: string;
  participant_id?: string | null;
  story_participants?: {
    id?: string;
    profiles?: {
      username?: string | null;
    };
  };
}

interface GenreTheme {
  bg: string;
  surface: string;
  border: string;
  accent: string;
  accentText: string;
  badge: string;
  gradient: string;
}

export default function StoryClient({
  storyId,
  story,
  turns,
  initialCanJoin,
  initialCurrentTurn,
  initialCurrentParticipantId,
  currentUsername,
  turnsPerWriter,
  currentParticipantTurnCount,
  initialLikeCount,
  initialUserLiked,
  theme,
  variant = 'timeline',
}: {
  storyId: string;
  story: StoryRecord;
  turns: TurnRecord[];
  initialCanJoin: boolean;
  initialCurrentTurn: number;
  initialCurrentParticipantId?: string | null;
  currentUsername?: string | null;
  turnsPerWriter?: number;
  currentParticipantTurnCount?: number;
  initialLikeCount: number;
  initialUserLiked: boolean;
  theme: GenreTheme;
  variant?: 'timeline' | 'sidebar' | 'header';
}) {
  const router = useRouter();
  const supabase = createClient();
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingFork, setLoadingFork] = useState(false);
  const [submittingChoice, setSubmittingChoice] = useState(false);
  const [forkOptions, setForkOptions] = useState<ForkOption[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCurrentUsersTurn, setIsCurrentUsersTurn] = useState(Boolean(initialCurrentParticipantId));
  const [choiceLocked, setChoiceLocked] = useState(false);
  const [copiedInvite, setCopiedInvite] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const remainingPlotTwists = Math.max((turnsPerWriter ?? 1) - (currentParticipantTurnCount ?? 0), 0);
  const [userLiked, setUserLiked] = useState(initialUserLiked);
  const [liking, setLiking] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const generateForkForTurn = async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) {
          return;
        }

        const { data: participants } = await supabase
          .from('story_participants')
          .select('id, user_id, turn_order, has_taken_turn')
          .eq('story_id', storyId)
          .order('turn_order', { ascending: true });

        const orderedParticipants = (participants ?? []) as StoryParticipant[];
        const turnsTakenByParticipant = (turns ?? []).reduce<Record<string, number>>((acc, turn) => {
          const participantId = turn.story_participants?.id ?? turn.participant_id ?? null;
          if (participantId) {
            acc[participantId] = (acc[participantId] ?? 0) + 1;
          }
          return acc;
        }, {});

        const nextParticipant = orderedParticipants
          .filter((entry) => (turnsTakenByParticipant[entry.id] ?? 0) < (story.turns_per_writer ?? 1))
          .sort((left, right) => {
            const leftTurns = turnsTakenByParticipant[left.id] ?? 0;
            const rightTurns = turnsTakenByParticipant[right.id] ?? 0;
            return leftTurns - rightTurns || left.turn_order - right.turn_order;
          })[0] ?? null;

        const isUsersTurn = Boolean(nextParticipant && nextParticipant.user_id === userData.user.id);

        if (!isMounted) {
          return;
        }

        setIsCurrentUsersTurn(isUsersTurn);

        if (!isUsersTurn) {
          return;
        }

        const currentTurnNumber = turns.length + 1;

        const { data: existingFork } = await supabase
          .from('forks')
          .select('id')
          .eq('story_id', storyId)
          .eq('turn_number', currentTurnNumber)
          .maybeSingle();

        if (!isMounted) {
          return;
        }

        if (existingFork) {
          const { data: existingOptions } = await supabase
            .from('fork_options')
            .select('id, content, option_index')
            .eq('fork_id', existingFork.id)
            .order('option_index', { ascending: true });

          if (isMounted) {
            setForkOptions(existingOptions ?? []);
          }
          return;
        }

        setLoadingFork(true);
        setError(null);

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-fork`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              story_id: story.id,
              turn_number: currentTurnNumber,
            }),
          },
        );

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || 'The fork generator failed.');
        }

        const result = await response.json();

        if (!isMounted) {
          return;
        }

        setForkOptions(result.options ?? []);
      } catch (fetchError) {
        if (isMounted) {
          setError(fetchError instanceof Error ? fetchError.message : 'Unable to generate fork options.');
        }
      } finally {
        if (isMounted) {
          setLoadingFork(false);
        }
      }
    };

    if (variant !== 'timeline') {
      return;
    }

    generateForkForTurn();

    return () => {
      isMounted = false;
    };
  }, [story.id, storyId, supabase, turns.length, variant]);

  const handleLockInChoice = async () => {
    if (!selectedOption) {
      setError('Please select a plot twist option before locking in your choice.');
      return;
    }

    setError(null);
    setSubmittingChoice(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error('You must be signed in to choose a plot twist.');
      }

      const currentTurnNumber = turns.length + 1;

      const { data: participant, error: participantError } = await supabase
        .from('story_participants')
        .select('id')
        .eq('story_id', storyId)
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (participantError || !participant) {
        throw new Error(participantError?.message ?? 'Could not find your participant record.');
      }

      const { data: existingFork, error: forkError } = await supabase
        .from('forks')
        .select('id')
        .eq('story_id', storyId)
        .eq('turn_number', currentTurnNumber)
        .maybeSingle();

      if (forkError || !existingFork) {
        throw new Error(forkError?.message ?? 'Could not find the plot twist for this turn.');
      }

      const selectedForkOption = forkOptions.find((option) => option.id === selectedOption);
      if (!selectedForkOption || selectedForkOption.option_index == null) {
        throw new Error('The selected plot twist option could not be found.');
      }

      const { error: insertTurnError } = await supabase
        .from('turns')
        .insert({
          story_id: storyId,
          participant_id: participant.id,
          fork_id: existingFork.id,
          chosen_option_index: selectedForkOption.option_index,
          chosen_text: selectedForkOption.content ?? '',
          turn_number: currentTurnNumber,
        });

      if (insertTurnError) {
        throw new Error(insertTurnError.message);
      }

      const { error: updateOptionError } = await supabase
        .from('fork_options')
        .update({ was_chosen: true })
        .eq('id', selectedForkOption.id);

      if (updateOptionError) {
        throw new Error(updateOptionError.message);
      }

      const { error: updateForkError } = await supabase
        .from('forks')
        .update({
          status: 'chosen',
          chosen_index: selectedForkOption.option_index,
        })
        .eq('id', existingFork.id);

      if (updateForkError) {
        throw new Error(updateForkError.message);
      }

      const { data: participantTurns } = await supabase
        .from('turns')
        .select('id')
        .eq('participant_id', participant.id);

      const turnsTaken = participantTurns?.length ?? 0;
      const hasCompletedTurnQuota = turnsTaken >= (story.turns_per_writer ?? 1);

      const { error: updateParticipantError } = await supabase
        .from('story_participants')
        .update({ has_taken_turn: hasCompletedTurnQuota })
        .eq('id', participant.id);

      if (updateParticipantError) {
        throw new Error(updateParticipantError.message);
      }

      const { data: allParticipants, error: participantsError } = await supabase
        .from('story_participants')
        .select('id')
        .eq('story_id', storyId);

      if (participantsError) {
        throw new Error(participantsError.message);
      }

      const { data: allTurns, error: turnsError } = await supabase
        .from('turns')
        .select('participant_id')
        .eq('story_id', storyId);

      if (turnsError) {
        throw new Error(turnsError.message);
      }

      const turnsTakenByParticipant = (allTurns ?? []).reduce<Record<string, number>>((acc, turn) => {
        const participantId = turn.participant_id ?? null;
        if (participantId) {
          acc[participantId] = (acc[participantId] ?? 0) + 1;
        }
        return acc;
      }, {});

      if ((allParticipants ?? []).length > 0 && allParticipants.every((entry) => (turnsTakenByParticipant[entry.id] ?? 0) >= (story.turns_per_writer ?? 1))) {
        const { error: completeStoryError } = await supabase
          .from('stories')
          .update({ status: 'completed' })
          .eq('id', storyId);

        if (completeStoryError) {
          throw new Error(completeStoryError.message);
        }
      }

      setChoiceLocked(true);
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to lock in your choice.');
    } finally {
      setSubmittingChoice(false);
    }
  };

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedInvite(true);
      setTimeout(() => setCopiedInvite(false), 1800);
    } catch {
      setError('Unable to copy the invite link automatically.');
    }
  };

  const handleToggleLike = async () => {
    setError(null);
    setLiking(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        router.push('/login');
        return;
      }

      if (userLiked) {
        const { error: deleteError } = await supabase
          .from('likes')
          .delete()
          .eq('story_id', storyId)
          .eq('user_id', userData.user.id);

        if (deleteError) {
          throw new Error(deleteError.message);
        }

        setUserLiked(false);
        setLikeCount((prev) => Math.max(0, prev - 1));
      } else {
        const { error: insertError } = await supabase
          .from('likes')
          .insert({ story_id: storyId, user_id: userData.user.id });

        if (insertError) {
          throw new Error(insertError.message);
        }

        setUserLiked(true);
        setLikeCount((prev) => prev + 1);
      }
    } catch (likeError) {
      setError(likeError instanceof Error ? likeError.message : 'Unable to update like status.');
    } finally {
      setLiking(false);
    }
  };

  const handleJoinStory = async () => {
    setError(null);
    setJoining(true);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError('You must be signed in to join this story.');
      setJoining(false);
      return;
    }

    const { data: participants } = await supabase
      .from('story_participants')
      .select('turn_order')
      .eq('story_id', storyId)
      .order('turn_order', { ascending: true });

    const participantRows = participants ?? [];
    const nextTurnOrder = participantRows.length > 0
      ? Math.max(...participantRows.map((entry) => entry.turn_order ?? 0)) + 1
      : 1;

    const { error: insertError } = await supabase.from('story_participants').insert({
      story_id: storyId,
      user_id: userData.user.id,
      turn_order: nextTurnOrder,
      has_taken_turn: false,
    });

    if (insertError) {
      setError(insertError.message);
      setJoining(false);
      return;
    }

    const nextWriterCount = (story.writer_count ?? 0) + 1;
    const shouldLock = nextWriterCount >= (story.max_writers ?? 0);

    const { error: updateError } = await supabase
      .from('stories')
      .update({
        writer_count: nextWriterCount,
        milestone_locked: shouldLock,
      })
      .eq('id', storyId);

    if (updateError) {
      setError(updateError.message);
      setJoining(false);
      return;
    }

    router.refresh();
    setJoining(false);
  };

  if (variant === 'header') {
    return (
      <button
        type='button'
        onClick={handleToggleLike}
        disabled={liking}
        className='inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70'
        style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.accentText }}
      >
        <span className='text-base'>{userLiked ? '❤️' : '♡'}</span>
        <span>{likeCount}</span>
      </button>
    );
  }

  if (variant === 'sidebar') {
    return (
      <aside className='space-y-4 rounded-sm border p-4 shadow-sm lg:p-5' style={{ backgroundColor: '#141414', borderColor: theme.border }}>
        <div className='flex flex-wrap items-center gap-3'>
          <button
            type='button'
            onClick={handleToggleLike}
            disabled={liking}
            className='inline-flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70'
            style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.accentText }}
          >
            <span className='text-base'>{userLiked ? '❤️' : '♡'}</span>
            <span>{likeCount}</span>
          </button>

          {initialCanJoin ? (
            <button
              type='button'
              onClick={handleJoinStory}
              disabled={joining}
              className='rounded-sm px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70'
              style={{ backgroundColor: theme.accent, color: theme.bg }}
            >
              {joining ? 'Joining...' : 'Join Story'}
            </button>
          ) : null}
        </div>

        {error ? <p className='rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100'>{error}</p> : null}
      </aside>
    );
  }

  return (
    <section className='space-y-6'>
      {((story.writer_count ?? 0) < (story.max_writers ?? 0)) ? (
        <article className='rounded-sm border p-4 shadow-sm lg:p-5' style={{ backgroundColor: '#141414', borderColor: theme.border }}>
          <p className='text-xs uppercase tracking-[0.35em]' style={{ color: theme.accent }}>Invite Writers</p>
          <h3 className='mt-3 text-xl font-semibold text-white'>Bring more collaborators into this story</h3>
          <p className='mt-2 text-sm text-[#bdbdb7]'>This story still has room for {Math.max((story.max_writers ?? 0) - (story.writer_count ?? 0), 0)} more writer(s).</p>
          <div className='mt-4 flex flex-wrap items-center gap-3'>
            <button
              type='button'
              onClick={handleCopyInvite}
              className='rounded-sm px-5 py-3 text-sm font-semibold transition hover:opacity-90'
              style={{ backgroundColor: theme.accent, color: theme.bg }}
            >
              {copiedInvite ? 'Invite link copied' : 'Copy invite link'}
            </button>
            <span className='text-xs uppercase tracking-[0.35em]' style={{ color: theme.accent }}>Share this page with friends</span>
          </div>
        </article>
      ) : null}

      <article className='rounded-sm border p-4 shadow-sm lg:p-5' style={{ backgroundColor: '#141414', borderColor: theme.border }}>
        <p className='text-xs uppercase tracking-[0.35em]' style={{ color: theme.accent }}>Current turn</p>
        <div className='mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <h3 className='text-xl font-semibold text-white'>@{currentUsername ?? 'Someone'}</h3>
            <p className='mt-1 text-sm text-[#bdbdb7]'>
              {isCurrentUsersTurn ? 'Your turn — choose the next plot twist.' : 'This writer is currently choosing the next plot twist.'}
            </p>
          </div>
          <div className='rounded-sm border px-4 py-3 text-sm' style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.accent }}>
            {remainingPlotTwists} plot twist{remainingPlotTwists === 1 ? '' : 's'} remaining
          </div>
        </div>

        {loadingFork ? (
          <div className='mt-4 animate-pulse border p-5' style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.accent }}>
            <p className='text-sm font-semibold uppercase tracking-[0.35em]' style={{ color: theme.accent }}>The story is thinking...</p>
            <p className='mt-2 text-sm text-[#f5f5f3]'>Generating your dramatic plot twist options now.</p>
          </div>
        ) : null}

        {forkOptions.length > 0 && !choiceLocked ? (
          <div className='mt-4 space-y-3'>
            {forkOptions.map((option, index) => (
              <button
                key={option.id ?? `${option.content}-${index}`}
                type='button'
                onClick={() => setSelectedOption(option.id ?? option.content ?? `option-${index}`)}
                onMouseEnter={() => setHoveredOption(index)}
                onMouseLeave={() => setHoveredOption(null)}
                className='w-full rounded-3xl border p-4 text-left transition hover:-translate-y-0.5'
                style={{
                  borderColor: selectedOption === (option.id ?? option.content ?? `option-${index}`)
                    ? theme.accent
                    : hoveredOption === index
                      ? theme.accent
                      : theme.border,
                  backgroundColor: selectedOption === (option.id ?? option.content ?? `option-${index}`)
                    ? `${theme.accent}22`
                    : hoveredOption === index
                      ? theme.surface
                      : theme.bg,
                  color: theme.accentText,
                }}
              >
                <p className='text-xs uppercase tracking-[0.35em]' style={{ color: theme.accent }}>Plot Twist {index + 1}</p>
                <p className='mt-2 text-base font-semibold text-white'>{option.content}</p>
              </button>
            ))}
          </div>
        ) : null}

        {selectedOption && !choiceLocked ? (
          <button
            type='button'
            onClick={handleLockInChoice}
            disabled={submittingChoice}
            className='mt-4 inline-flex rounded-sm px-5 py-3 text-sm font-semibold transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70'
            style={{ backgroundColor: theme.accent, color: theme.bg }}
          >
            {submittingChoice ? 'Locking in...' : 'Lock In Your Choice'}
          </button>
        ) : null}

        {!loadingFork && forkOptions.length === 0 && isCurrentUsersTurn ? (
          <p className='mt-4 rounded-sm border p-4 text-sm' style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.accentText }}>
            The story is ready for your next move.
          </p>
        ) : null}

        {error ? <p className='mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100'>{error}</p> : null}
      </article>
    </section>
  );
}
