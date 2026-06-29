import Link from 'next/link'
import BottomNav from '@/components/layout/BottomNav'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="flex flex-col min-h-screen bg-gray-950 text-white">
      <header className="flex items-center justify-between px-4 pt-4 pb-3">
        <h1 className="text-white font-semibold text-lg">賛美カナルビ</h1>
        <Link href="/songs" className="text-gray-400 p-2 hover:text-white transition-colors">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center pb-24 px-6 text-center">
        <Link
          href="/recognize"
          className="relative w-48 h-48 rounded-full bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all duration-300 flex flex-col items-center justify-center gap-3 shadow-lg shadow-blue-900/40 group cursor-pointer"
        >
          {/* 波打つようなエフェクト */}
          <span className="absolute inset-0 rounded-full bg-blue-500/20 group-hover:animate-ping opacity-70" />
          
          <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="23" />
            <line x1="8" y1="23" x2="16" y2="23" />
          </svg>
          <span className="text-lg font-bold">聞き取る</span>
        </Link>
        <p className="text-gray-500 text-sm mt-8 max-w-xs leading-relaxed">
          ボタンを押して賛美を聞き取り、カナルビ歌詞を検索します。
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
