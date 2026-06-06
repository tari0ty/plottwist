import Navbar from '@/components/Navbar';

export default function RemixLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
