import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import ProfileSetupForm from './ProfileSetupForm';

export default async function ProfileSetupPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;

  if (error || !user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, bio, contact_link')
    .eq('id', user.id)
    .maybeSingle();

  return (
    <ProfileSetupForm
      userId={user.id}
      initialUsername={profile?.username ?? ''}
      initialBio={profile?.bio ?? ''}
      initialContactLink={profile?.contact_link ?? ''}
    />
  );
}
