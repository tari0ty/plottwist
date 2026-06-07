'use client';

import { useCallback, useEffect, useState } from 'react';
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
  turn_skipped?: boolean | null;
  turn_started_at?: string | null;
  profiles?: {
    username?: string | null;
  } | {
    username?: string | null;
  }[] | null;
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

function formatRemainingTime(deadline: string | null) {
  if (!deadline) {
    return null;
  }

  const remainingMs = new Date(deadline).getTime() - Date.now();
  if (remainingMs <= 0) {
    return '0h 0m remaining';
  }

  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m remaining`;
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
  joinRequestStatus,
  theme,
  isAuthor,
  isParticipant,
  storyStatus,
  turnDeadline,
  allParticipants,
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
  joinRequestStatus?: string | null;
  theme: GenreTheme;
  isAuthor: boolean;
  isParticipant: boolean;
  storyStatus: string;
  turnDeadline: string | null;
  allParticipants: StoryParticipant[];
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
  const [requestStatus, setRequestStatus] = useState(joinRequestStatus ?? null);
  const [requestSubmitted, setRequestSubmitted] = useState(false);
  const [startingStory, setStartingStory] = useState(false);
  const [autoSkipping, setAutoSkipping] = useState(false);
  const [, setCountdownTick] = useState(0);
  const shouldShowJoinButton = initialCanJoin && storyStatus !== 'active' && storyStatus !== 'completed' && requestStatus !== 'pending' && requestStatus !== 'accepted';
  const canStartStory = (story.writer_count ?? 0) >= 2;
  const currentParticipant = allParticipants.find((entry) => entry.user_id === initialCurrentParticipantId) ?? null;
  const currentParticipantIndex = currentParticipant ? allParticipants.findIndex((entry) => entry.id === currentParticipant.id) : -1;
  const previousParticipant = currentParticipantIndex >= 0 && allParticipants.length > 1
    ? allParticipants[(currentParticipantIndex - 1 + allParticipants.length) % allParticipants.length]
    : null;
  const inheritedSkippedTurn = Boolean(isCurrentUsersTurn && previousParticipant?.turn_skipped);
  const timeRemaining = isCurrentUsersTurn ? formatRemainingTime(turnDeadline) : null;

  const handleAutoSkipTurn = useCallback(async () => {
    if (!currentParticipant || autoSkipping) {
      return;
    }

    setAutoSkipping(true);
    setError(null);

    try {
      const { error: skipError } = await supabase
        .from('story_participants')
        .update({
          turn_skipped: true,
          has_taken_turn: true,
        })
        .eq('id', currentParticipant.id);

      if (skipError) {
        throw new Error(skipError.message);
      }

      router.refresh();
    } catch (skipError) {
      setError(skipError instanceof Error ? skipError.message : 'Unable to skip this turn automatically.');
    } finally {
      setAutoSkipping(false);
    }
  }, [autoSkipping, currentParticipant, router, supabase]);

  useEffect(() => {
    if (variant !== 'timeline' || !isCurrentUsersTurn || !turnDeadline) {
      return;
    }

    const updateCountdown = () => {
      setCountdownTick((current) => current + 1);

      if (new Date(turnDeadline).getTime() <= Date.now()) {
        handleAutoSkipTurn();
      }
    };

    const timeoutId = window.setTimeout(updateCountdown, 0);
    const intervalId = window.setInterval(updateCountdown, 60000);

    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [handleAutoSkipTurn, isCurrentUsersTurn, turnDeadline, variant]);

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

    if (variant !== 'timeline' || !isParticipant || storyStatus === 'recruiting') {
      return;
    }

    generateForkForTurn();

    return () => {
      isMounted = false;
    };
  }, [isParticipant, story.id, story.turns_per_writer, storyId, storyStatus, supabase, turns, turns.length, variant]);

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

      // Wait briefly for the update to propagate
      await new Promise(resolve => setTimeout(resolve, 500));

      const { data: freshParticipants } = await supabase
        .from('story_participants')
        .select('has_taken_turn')
        .eq('story_id', storyId);

      const allDone = (freshParticipants ?? []).every((p) => p.has_taken_turn === true);

      console.log('freshParticipants:', freshParticipants);
      console.log('allDone:', allDone);

      if (allDone) {
        const { error: completeError } = await supabase
          .from('stories')
          .update({ status: 'completed' })
          .eq('id', storyId);
        console.log('completeError:', completeError);
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

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setError('You must be signed in to request a place in this story.');
        return;
      }

      const { data: existingRequest } = await supabase
        .from('join_requests')
        .select('id, status')
        .eq('story_id', storyId)
        .eq('user_id', userData.user.id)
        .maybeSingle();

      if (existingRequest) {
        setRequestStatus(existingRequest.status ?? 'pending');
        setRequestSubmitted(existingRequest.status === 'pending');
        setError(null);
        return;
      }

      const { error: insertError } = await supabase
        .from('join_requests')
        .insert({
          story_id: storyId,
          user_id: userData.user.id,
          status: 'pending',
        });

      if (insertError) {
        throw new Error(insertError.message);
      }

      setRequestStatus('pending');
      setRequestSubmitted(true);
      router.refresh();
    } catch (joinError) {
      setError(joinError instanceof Error ? joinError.message : 'Unable to send your join request.');
    } finally {
      setJoining(false);
    }
  };

  const handleStartStory = async () => {
    if (!canStartStory) {
      return;
    }

    setError(null);
    setStartingStory(true);

    try {
      const { error: updateStoryError } = await supabase
        .from('stories')
        .update({ status: 'active' })
        .eq('id', storyId);

      if (updateStoryError) {
        throw new Error(updateStoryError.message);
      }

      const { error: deleteRequestsError } = await supabase
        .from('join_requests')
        .delete()
        .eq('story_id', storyId)
        .eq('status', 'pending');

      if (deleteRequestsError) {
        throw new Error(deleteRequestsError.message);
      }

      router.refresh();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Unable to start this story.');
    } finally {
      setStartingStory(false);
    }
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

          {requestStatus === 'pending' || requestStatus === 'accepted' ? (
            <span
              className='rounded-sm border px-5 py-3 text-sm font-semibold'
              style={{ borderColor: theme.border, backgroundColor: theme.surface, color: theme.accentText }}
            >
              {requestStatus === 'pending' ? 'Request Pending' : 'Request Accepted'}
            </span>
          ) : null}

          {shouldShowJoinButton ? (
            <button
              type='button'
              onClick={handleJoinStory}
              disabled={joining || requestStatus === 'declined' || requestSubmitted}
              className='rounded-sm px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70'
              style={{ backgroundColor: theme.accent, color: theme.bg }}
            >
              {joining
                ? 'Sending request...'
                : requestStatus === 'declined'
                  ? 'Request Declined'
                  : requestSubmitted
                    ? 'Request Sent'
                    : requestStatus === 'pending'
                      ? 'Request Pending'
                      : 'Join Story'}
            </button>
          ) : null}

          {isAuthor && storyStatus === 'recruiting' ? (
            <button
              type='button'
              onClick={handleStartStory}
              disabled={!canStartStory || startingStory}
              title={!canStartStory ? 'Need at least 2 writers to start' : undefined}
              className='rounded-sm px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70'
              style={{ backgroundColor: theme.accent, color: theme.bg }}
            >
              {startingStory ? 'Starting...' : 'Start Story'}
            </button>
          ) : null}
        </div>

        {error ? <p className='rounded-2xl border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-100'>{error}</p> : null}
      </aside>
    );
  }

  return (
    <section className='space-y-6'>
      {isAuthor && ((story.writer_count ?? 0) < (story.max_writers ?? 0)) ? (
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

      {storyStatus === 'recruiting' ? (
        <article className='rounded-sm border p-4 shadow-sm lg:p-5' style={{ backgroundColor: '#141414', borderColor: theme.border }}>
          <p className='text-sm text-[#f5f5f3]'>This story is recruiting writers. The author will start the story once the lineup is ready.</p>
        </article>
      ) : isParticipant ? (
      <article className='rounded-sm border p-4 shadow-sm lg:p-5' style={{ backgroundColor: '#141414', borderColor: theme.border }}>
        <p className='text-xs uppercase tracking-[0.35em]' style={{ color: theme.accent }}>Current turn</p>
        <div className='mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
          <div>
            <h3 className='text-xl font-semibold text-white'>@{currentUsername ?? 'Someone'}</h3>
            <p className='mt-1 text-sm text-[#bdbdb7]'>
              {isCurrentUsersTurn ? 'Your turn — choose the next plot twist.' : 'This writer is currently choosing the next plot twist.'}
            </p>
            {isCurrentUsersTurn && timeRemaining ? (
              <p className='mt-2 text-sm font-semibold' style={{ color: theme.accent }}>{timeRemaining}</p>
            ) : null}
            {inheritedSkippedTurn ? (
              <p className='mt-3 rounded-sm border p-3 text-sm' style={{ borderColor: theme.accent, backgroundColor: `${theme.accent}15`, color: theme.accentText }}>
                The previous writer ran out of time. Their choices are now yours.
              </p>
            ) : null}
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
      ) : null}
    </section>
  );
}
