'use client';

import Link from 'next/link';

export default function NavbarClient({
  username,
  isLoggedIn,
}: {
  username: string;
  isLoggedIn: boolean;
}) {
  return (
    <header className='sticky top-0 z-10 mb-8 border border-[#222222] bg-[#0a0a0a]/95 p-4 backdrop-blur'>
      <nav className='mx-auto flex w-full max-w-7xl items-center justify-between gap-4'>
        <Link href='/' className='flex items-center gap-3 text-xl font-serif tracking-[0.08em] text-white'>
          <span className='inline-flex h-10 w-10 items-center justify-center rounded-sm border border-[#2a2a2a] bg-[#111111] text-base font-black text-[#e8d5b7]'>P</span>
          PlotTwist
        </Link>

        <div className='flex items-center gap-3'>
          <Link href='/completed' className='rounded-sm border border-[#2a2a2a] bg-[#111111] px-4 py-2 text-sm font-semibold text-[#f5f5f3] transition hover:border-[#3a3a3a] hover:bg-[#161616]'>
            Hall of Fame
          </Link>
          <Link href='/create' className='rounded-sm bg-[#e8d5b7] px-4 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#f0e3ce]'>
            Start a Story
          </Link>

          {isLoggedIn ? (
            <Link
              href={`/profile/${username}`}
              className='flex items-center gap-2 rounded-sm border border-[#2a2a2a] bg-[#111111] px-3 py-2 text-sm font-semibold text-[#f5f5f3] transition hover:border-[#3a3a3a] hover:bg-[#161616]'
            >
              <span className='inline-flex h-8 w-8 items-center justify-center rounded-sm bg-[#e8d5b7] text-xs font-black text-[#111111]'>
                {username.charAt(0).toUpperCase()}
              </span>
              <span>{username}</span>
            </Link>
          ) : (
            <Link href='/login' className='rounded-sm border border-[#2a2a2a] bg-[#111111] px-4 py-2 text-sm font-semibold text-[#f5f5f3] transition hover:border-[#3a3a3a] hover:bg-[#161616]'>
              Sign In
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
