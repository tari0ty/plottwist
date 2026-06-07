import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { acceptJoinRequest, declineJoinRequest } from './actions';

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

export default async function RequestsPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect('/login');
  }

  const { data: requestsData } = await supabase
    .from('join_requests')
    .select('id, status, story_id, user_id, created_at, profiles(username), stories(id, title, genre, author_id, writer_count, max_writers)')
    .order('created_at', { ascending: false });

  const allRequests = (requestsData ?? []).filter((entry) => (entry.stories as Array<{ author_id?: string | null }> | undefined)?.[0]?.author_id === userData.user.id);

  const pendingRequests = allRequests.filter((entry) => entry.status === 'pending');
  const acceptedRequests = allRequests.filter((entry) => entry.status === 'accepted');
  const declinedRequests = allRequests.filter((entry) => entry.status === 'declined');

  const groupByStory = (items: typeof allRequests) => {
    const grouped = new Map<string, typeof items[number][]>();

    items.forEach((item) => {
      const key = item.story_id ?? 'unknown';
      const existing = grouped.get(key) ?? [];
      existing.push(item);
      grouped.set(key, existing);
    });

    return grouped;
  };

  const pendingGroups = groupByStory(pendingRequests);
  const acceptedGroups = groupByStory(acceptedRequests);
  const declinedGroups = groupByStory(declinedRequests);

  return (
    <main className='min-h-screen bg-[#0a0a0a] text-white'>
      <section className='mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8'>
        <header className='mb-8 border border-[#222222] bg-[#111111] p-6'>
          <p className='text-sm uppercase tracking-[0.35em] text-[#e8d5b7]'>Requests</p>
          <h1 className='mt-3 font-serif text-4xl font-black tracking-tight text-white'>Writer join requests</h1>
          <p className='mt-3 max-w-2xl text-sm text-[#bdbdb7]'>Review pending requests, accept new collaborators, or decline them before the next turn begins.</p>
        </header>

        <section className='space-y-8'>
          <article className='space-y-6'>
            <div className='flex items-center justify-between gap-4'>
              <h2 className='font-serif text-2xl font-semibold text-white'>Pending requests</h2>
              <span className='rounded-sm border border-[#2a2a2a] bg-[#151515] px-3 py-1 text-xs uppercase tracking-[0.25em] text-[#e8d5b7]'>{pendingRequests.length} waiting</span>
            </div>

            {pendingGroups.size > 0 ? (
              <div className='space-y-6'>
                {Array.from(pendingGroups.entries()).map(([storyId, items]) => {
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

                          return (
                            <article key={request.id} className='rounded-sm border p-4' style={{ backgroundColor: `${theme.accent}15`, borderColor: theme.border }}>
                              <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
                                <div>
                                  <p className='text-sm text-[#f5f5f3]'>
                                    <Link href={`/profile/${requester?.username ?? 'profile'}`} className='font-semibold text-white hover:text-[#e8d5b7]'>
                                      {requester?.username ?? 'Unknown writer'}
                                    </Link>
                                    {' '}wants to join this story.
                                  </p>
                                  <p className='mt-1 text-xs uppercase tracking-[0.25em] text-[#bdbdb7]'>Requested {new Date(request.created_at ?? '').toLocaleDateString()}</p>
                                </div>
                                <div className='flex flex-wrap gap-3'>
                                  <form action={acceptJoinRequest}>
                                    <input type='hidden' name='requestId' value={request.id} />
                                    <input type='hidden' name='storyId' value={request.story_id ?? storyId} />
                                    <button type='submit' className='rounded-sm px-4 py-2 text-sm font-semibold text-[#111111] transition hover:opacity-90' style={{ backgroundColor: theme.accent }}>
                                      Accept
                                    </button>
                                  </form>
                                  <form action={declineJoinRequest}>
                                    <input type='hidden' name='requestId' value={request.id} />
                                    <input type='hidden' name='storyId' value={request.story_id ?? storyId} />
                                    <button type='submit' className='rounded-sm border border-[#2a2a2a] bg-[#111111] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#161616]'>
                                      Decline
                                    </button>
                                  </form>
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

            <section className='rounded-sm border border-[#222222] bg-[#111111] p-6'>
              <h2 className='font-serif text-2xl font-semibold text-white'>Declined requests</h2>
              {declinedGroups.size > 0 ? (
                <div className='mt-4 space-y-4'>
                  {Array.from(declinedGroups.entries()).map(([storyId, items]) => {
                    const story = Array.isArray(items[0]?.stories) ? items[0].stories[0] : items[0]?.stories;

                    return (
                      <article key={storyId} className='rounded-sm border border-[#2a2a2a] bg-[#151515] p-4'>
                        <p className='text-sm font-semibold text-white'>{story?.title ?? 'Untitled story'}</p>
                        <p className='mt-1 text-sm text-[#bdbdb7]'>{items.length} request{items.length === 1 ? '' : 's'} declined.</p>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className='mt-4 text-sm text-[#888888]'>No declined requests yet.</p>
              )}
            </section>
          </article>
        </section>
      </section>
    </main>
  );
}
