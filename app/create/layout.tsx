import Navbar from '@/components/Navbar';

export default function CreateLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
    </>
  );
}
