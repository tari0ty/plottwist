'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';

export async function acceptJoinRequest(formData: FormData) {
  const requestId = String(formData.get('requestId') ?? '');
  const storyId = String(formData.get('storyId') ?? '');

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect('/login');
  }

  const { data: story } = await supabase
    .from('stories')
    .select('id, author_id, writer_count, max_writers, milestone_locked')
    .eq('id', storyId)
    .single();

  if (!story || story.author_id !== userData.user.id) {
    redirect('/requests');
  }

  const { data: request } = await supabase
    .from('join_requests')
    .select('id, story_id, user_id, status')
    .eq('id', requestId)
    .eq('story_id', storyId)
    .maybeSingle();

  if (!request || request.status !== 'pending') {
    redirect('/requests');
  }

  await supabase
    .from('join_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId);

  const { data: latestParticipants } = await supabase
    .from('story_participants')
    .select('turn_order')
    .eq('story_id', storyId)
    .order('turn_order', { ascending: false })
    .limit(1);

  const nextTurnOrder = (latestParticipants?.[0]?.turn_order ?? 0) + 1;

  await supabase
    .from('story_participants')
    .insert({
      story_id: storyId,
      user_id: request.user_id,
      turn_order: nextTurnOrder,
      has_taken_turn: false,
    });

  const nextWriterCount = (story.writer_count ?? 0) + 1;
  const shouldLock = nextWriterCount >= (story.max_writers ?? 0);

  await supabase
    .from('stories')
    .update({
      writer_count: nextWriterCount,
      milestone_locked: shouldLock,
    })
    .eq('id', storyId);

  revalidatePath('/requests');
  redirect('/requests');
}

export async function declineJoinRequest(formData: FormData) {
  const requestId = String(formData.get('requestId') ?? '');
  const storyId = String(formData.get('storyId') ?? '');

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect('/login');
  }

  const { data: story } = await supabase
    .from('stories')
    .select('id, author_id')
    .eq('id', storyId)
    .single();

  if (!story || story.author_id !== userData.user.id) {
    redirect('/requests');
  }

  await supabase
    .from('join_requests')
    .update({ status: 'declined' })
    .eq('id', requestId)
    .eq('story_id', storyId);

  revalidatePath('/requests');
  redirect('/requests');
}
