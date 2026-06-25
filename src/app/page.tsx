import Link from 'next/link'
import ListenButton from '@/components/home/ListenButton'
import BottomNav from '@/components/layout/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="text-white font-semibold text-lg">賛美カナルビ</h1>
        <Link href="/search" className="text-gray-400 p-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center pb-24">
        <ListenButton />
      </main>

      <BottomNav />
    </div>
  )
}
