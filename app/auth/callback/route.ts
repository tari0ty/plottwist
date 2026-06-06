import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  console.log('callback hit');
  console.log('code:', code);

  if (!code) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const supabase = await createClient();
  await supabase.auth.exchangeCodeForSession(code);

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  console.log('user:', user);
  if (userError || !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('username, bio')
    .eq('id', user.id)
    .maybeSingle();

  console.log('profile:', profile);

  const username = profile?.username?.trim() ?? '';
  const shouldSetupProfile =
    profileError ||
    !profile ||
    !profile.bio ||
    username.includes('@') ||
    username.startsWith('user_');

  return NextResponse.redirect(
    new URL(shouldSetupProfile ? '/profile/setup' : '/', request.url),
  );
}
