import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, church_id')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="px-4 pt-4 pb-3 border-b border-gray-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-400 p-1 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="text-white font-semibold">管理ダッシュボード</h1>
        </div>
      </header>

      <main className="px-4 py-6 max-w-lg mx-auto space-y-4">
        <p className="text-gray-400 text-xs">
          賛美カナルビシステムの管理用メニューです。
        </p>

        <div className="grid grid-cols-1 gap-4">
          <Link
            href="/admin/songs"
            className="flex items-center gap-4 bg-gray-900 rounded-xl p-4 hover:bg-gray-800 transition-colors border border-gray-800"
          >
            <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-medium text-sm">曲管理</p>
              <p className="text-gray-500 text-xs mt-0.5">登録されている曲の編集・カナルビ生成を行います。</p>
            </div>
            <span className="text-gray-500 text-sm">➔</span>
          </Link>

          <Link
            href="/admin/songs/new"
            className="flex items-center gap-4 bg-gray-900 rounded-xl p-4 hover:bg-gray-800 transition-colors border border-gray-800"
          >
            <div className="w-10 h-10 bg-green-900/50 rounded-lg flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-400">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-medium text-sm">曲を追加</p>
              <p className="text-gray-500 text-xs mt-0.5">新しい賛美の登録とカナルビの作成を開始します。</p>
            </div>
            <span className="text-gray-500 text-sm">➔</span>
          </Link>

          <Link
            href="/admin/members"
            className="flex items-center gap-4 bg-gray-900 rounded-xl p-4 hover:bg-gray-800 transition-colors border border-gray-800"
          >
            <div className="w-10 h-10 bg-purple-900/50 rounded-lg flex items-center justify-center shrink-0">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-400">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-white font-medium text-sm">メンバー管理</p>
              <p className="text-gray-500 text-xs mt-0.5">教会所属メンバーの権限等の確認を行います。</p>
            </div>
            <span className="text-gray-500 text-sm">➔</span>
          </Link>
        </div>
      </main>
    </div>
  )
}
