import { createClient } from '@/utils/supabase/server';
import NavbarClient from './NavbarClient';

export default async function Navbar() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;

  const { data: profileData } = user
    ? await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
    : { data: null };

  return (
    <NavbarClient
      username={profileData?.username ?? user?.id ?? 'profile'}
      isLoggedIn={Boolean(user)}
    />
  );
}
