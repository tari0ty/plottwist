import { createClient } from '@/utils/supabase/server';
import NavbarClient from './NavbarClient';

export default async function Navbar() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  const { data: profileData } = user
    ? await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
    : { data: null };

  let pendingRequestCount = 0;

  if (user) {
    const { data: authoredStories } = await supabase
      .from('stories')
      .select('id')
      .eq('author_id', user.id);

    const storyIds = (authoredStories ?? [])
      .map((entry) => entry.id)
      .filter(Boolean) as string[];

    if (storyIds.length > 0) {
      const { count } = await supabase
        .from('join_requests')
        .select('*', { count: 'exact', head: true })
        .in('story_id', storyIds)
        .eq('status', 'pending');

      pendingRequestCount = count ?? 0;
    }
  }

  return (
    <NavbarClient
      username={profileData?.username ?? user?.id ?? 'profile'}
      isLoggedIn={Boolean(user)}
      pendingRequestCount={pendingRequestCount}
    />
  );
}
