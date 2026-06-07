import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import MyStoriesClient, { JoinRequestRecord, ParticipantStoryRecord, StoryRecord } from './MyStoriesClient';

function unwrapStory(story: StoryRecord | StoryRecord[] | null | undefined) {
  return Array.isArray(story) ? story[0] : story;
}

export default async function MyStoriesPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const user = userData.user;

  if (userError || !user) {
    redirect('/login');
  }

  const { data: authoredStories } = await supabase
    .from('stories')
    .select('id, title, genre, status, writer_count, max_writers, author_id, opening_line, turns_per_writer')
    .eq('author_id', user.id)
    .order('created_at', { ascending: false });

  const { data: joinedRows } = await supabase
    .from('story_participants')
    .select('id, story_id, user_id, turn_order, has_taken_turn, stories(id, title, genre, status, writer_count, max_writers, author_id, opening_line, turns_per_writer)')
    .eq('user_id', user.id)
    .order('turn_order', { ascending: true });

  const { data: pendingRequestsData } = await supabase
    .from('join_requests')
    .select('id, story_id, user_id, status, created_at, profiles(username), stories(id, title, genre, author_id, status, writer_count, max_writers)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  const pendingRequests = ((pendingRequestsData ?? []) as JoinRequestRecord[]).filter((request) => {
    const story = unwrapStory(request.stories);
    return story?.author_id === user.id;
  });

  const joinedStories = ((joinedRows ?? []) as ParticipantStoryRecord[])
    .map((row) => unwrapStory(row.stories))
    .filter((story): story is StoryRecord => Boolean(story && story.author_id !== user.id));

  const participantStoryIds = Array.from(new Set(((joinedRows ?? []) as ParticipantStoryRecord[])
    .map((row) => row.story_id)
    .filter((storyId): storyId is string => Boolean(storyId))));

  const yourTurnStories = (await Promise.all(participantStoryIds.map(async (storyId) => {
    const { data: participants } = await supabase
    .from('story_participants')
      .select('id, story_id, user_id, turn_order, has_taken_turn, stories(id, title, genre, status, writer_count, max_writers, author_id, opening_line, turns_per_writer)')
      .eq('story_id', storyId)
      .order('turn_order', { ascending: true });

    const { data: turns } = await supabase
      .from('turns')
      .select('participant_id')
      .eq('story_id', storyId);

    const orderedParticipants = (participants ?? []) as ParticipantStoryRecord[];
    const story = unwrapStory(orderedParticipants[0]?.stories);

    if (!story || story.status !== 'active') {
      return null;
    }

    const turnsTakenByParticipant = (turns ?? []).reduce<Record<string, number>>((acc, turn) => {
      const participantId = turn.participant_id ?? null;
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

    return nextParticipant?.user_id === user.id ? story : null;
  }))).filter((story): story is StoryRecord => Boolean(story));

  return (
    <main className='min-h-screen bg-[#0a0a0a] text-white'>
      <section className='mx-auto min-h-screen w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8'>
        <header className='mb-8 border border-[#222222] bg-[#111111] p-6'>
          <p className='text-sm uppercase tracking-[0.35em] text-[#e8d5b7]'>Dashboard</p>
          <h1 className='mt-3 font-serif text-4xl font-black tracking-tight text-white'>My Stories</h1>
          <p className='mt-3 max-w-2xl text-sm text-[#bdbdb7]'>Track your turns, manage requests, and keep every story moving.</p>
        </header>

        <MyStoriesClient
          authoredStories={(authoredStories ?? []) as StoryRecord[]}
          joinedStories={joinedStories}
          pendingRequests={pendingRequests}
          yourTurnStories={yourTurnStories}
        />
      </section>
    </main>
  );
}
