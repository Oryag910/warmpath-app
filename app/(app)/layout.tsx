import Nav from '@/components/nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Nav />
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  )
}
