import type { Metadata } from "next";
import Navbar from '@/components/Navbar';
import "./globals.css";

export const metadata: Metadata = {
  title: 'PlotTwist',
  description: 'A collaborative storytelling app where groups build stories together through choices. No writing required — just decisions.',
  openGraph: {
    title: 'PlotTwist',
    description: 'A collaborative storytelling app where groups build stories together through choices. No writing required — just decisions.',
    url: 'https://plottwist-seven.vercel.app',
    siteName: 'PlotTwist',
    type: 'website',
  },
  twitter: {
    card: 'summary',
    title: 'PlotTwist',
    description: 'A collaborative storytelling app where groups build stories together through choices. No writing required — just decisions.',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased overflow-x-hidden">
      <body className="min-h-full w-full max-w-full overflow-x-hidden flex flex-col bg-[#0a0a0a] text-white">
        <Navbar />
        <div className="w-full max-w-full overflow-x-hidden">{children}</div>
      </body>
    </html>
  );
}

