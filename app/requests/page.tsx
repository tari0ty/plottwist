import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import RequestsClient from './RequestsClient';

export default async function RequestsPage() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect('/login');
  }

  const { data: requestsData, error: requestsError } = await supabase
    .from('join_requests')
    .select('*, profiles(username), stories(title, genre, author_id)')
    .order('created_at', { ascending: false });

  console.log('join requests query result', requestsData);
  console.log('join requests query error', requestsError);

  const allRequests = (requestsData ?? []).filter((entry) => {
    const story = Array.isArray(entry.stories) ? entry.stories[0] : entry.stories;
    return story?.author_id === userData.user.id;
  });

  return (
    <main className='min-h-screen bg-[#0a0a0a] text-white'>
      <section className='mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8'>
        <header className='mb-8 border border-[#222222] bg-[#111111] p-6'>
          <p className='text-sm uppercase tracking-[0.35em] text-[#e8d5b7]'>Requests</p>
          <h1 className='mt-3 font-serif text-4xl font-black tracking-tight text-white'>Writer join requests</h1>
          <p className='mt-3 max-w-2xl text-sm text-[#bdbdb7]'>Review pending requests, accept new collaborators, or decline them before the next turn begins.</p>
        </header>

        <RequestsClient initialRequests={allRequests} />
      </section>
    </main>
  );
}
