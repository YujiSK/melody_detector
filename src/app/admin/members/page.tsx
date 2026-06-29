import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function AdminMembersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, church_id')
    .eq('id', user.id)
    .single()

  const disableAuth = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'
  if (!profile || (!disableAuth && profile.role !== 'admin')) redirect('/')

  // profiles テーブルから同じ教会（church_id）に属するユーザーを取得
  const { data: members } = await supabase
    .from('profiles')
    .select('id, display_name, role, created_at')
    .eq('church_id', profile.church_id)
    .order('created_at', { ascending: false })

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="px-4 pt-4 pb-3 border-b border-gray-900 flex items-center gap-3">
        <Link href="/admin" className="text-gray-400 p-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-white font-semibold">メンバー管理</h1>
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto space-y-4">
        <p className="text-gray-400 text-xs">
          このチャーチに所属するメンバーの一覧です。
        </p>

        <div className="space-y-2">
          {members?.map(member => (
            <div
              key={member.id}
              className="flex items-center justify-between bg-gray-900 rounded-xl px-4 py-3"
            >
              <div>
                <p className="text-white text-sm font-medium">{member.display_name || '名称未設定'}</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  登録日: {new Date(member.created_at).toLocaleDateString('ja-JP')}
                </p>
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-mono
                ${member.role === 'admin'
                  ? 'bg-red-900/50 text-red-400'
                  : 'bg-blue-900/50 text-blue-400'
                }`}
              >
                {member.role === 'admin' ? '管理者' : 'メンバー'}
              </span>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
