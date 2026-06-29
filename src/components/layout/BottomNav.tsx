'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const items = [
  {
    href: '/',
    label: '聞き取る',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="23" />
        <line x1="8" y1="23" x2="16" y2="23" />
      </svg>
    ),
  },
  {
    href: '/songs',
    label: '検索',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: '#profile',
    label: 'マイページ',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [user, setUser] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [profile, setProfile] = useState<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [church, setChurch] = useState<any>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadUser() {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser()
        if (authUser) {
          setUser(authUser)
          const { data: prof } = await supabase
            .from('profiles')
            .select('display_name')
            .eq('id', authUser.id)
            .single()

          const { data: member } = await supabase
            .from('church_members')
            .select('church_id, role')
            .eq('user_id', authUser.id)
            .single()

          if (prof) {
            setProfile({
              display_name: prof.display_name,
              role: member?.role || 'member',
              church_id: member?.church_id || null,
            })
            if (member?.church_id) {
              const { data: ch } = await supabase
                .from('churches')
                .select('name')
                .eq('id', member.church_id)
                .single()
              setChurch(ch)
            }
          }
        }
      } catch (e) {
        console.error('Error loading profile in BottomNav:', e)
      } finally {
        setLoading(false)
      }
    }
    loadUser()
  }, [supabase])

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 flex relative z-40">
        <span className="absolute bottom-1 right-2 text-[9px] text-gray-600 font-mono pointer-events-none select-none">
          v0.1.1
        </span>
        {items.map((item) => {
          const active = pathname === item.href
          if (item.href === '#profile') {
            return (
              <button
                key={item.href}
                onClick={() => setIsOpen(true)}
                className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors cursor-pointer
                  ${active ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {item.icon}
                <span className="text-xs">{item.label}</span>
              </button>
            )
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors
                ${active ? 'text-blue-400' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {item.icon}
              <span className="text-xs">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Profile Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-sm p-6 space-y-4 relative text-left">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white font-bold w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-800 transition-colors"
            >
              ✕
            </button>
            <h3 className="text-white font-semibold text-lg border-b border-gray-800 pb-2">マイプロフィール</h3>

            {loading ? (
              <div className="py-8 text-center text-gray-500 text-xs animate-pulse">読み込み中…</div>
            ) : !user ? (
              <div className="space-y-4 py-2">
                <p className="text-red-400 font-semibold text-sm">ログインしていません</p>
                <p className="text-gray-400 text-xs">カナルビ機能を利用するにはログインが必要です。</p>
                <button
                  onClick={() => {
                    setIsOpen(false)
                    router.push('/login')
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
                >
                  ログイン画面へ
                </button>
              </div>
            ) : (
              <div className="space-y-3.5 text-xs font-mono">
                {/* Profile Missing Warning */}
                {!profile && (
                  <div className="bg-yellow-950/30 border border-yellow-900/50 rounded-xl p-3 text-yellow-400 font-sans leading-relaxed">
                    ⚠️ <strong>初期セットアップが必要です。</strong><br />
                    プロファイルが未検出です。音声認識 ➔ 新規曲の登録、または管理者APIへの最初のリクエスト時に自動作成されます。
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between border-b border-gray-850 py-1">
                    <span className="text-gray-500 font-sans">Auth Status</span>
                    <span className="text-green-400 font-semibold">Logged In</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-850 py-1">
                    <span className="text-gray-500 font-sans">Email</span>
                    <span className="text-white truncate max-w-[200px] select-all">{user.email}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-850 py-1">
                    <span className="text-gray-500 font-sans">Display Name</span>
                    <span className="text-white">{profile?.display_name ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-850 py-1">
                    <span className="text-gray-500 font-sans">Church</span>
                    <span className="text-white truncate max-w-[200px]">{church?.name ?? 'N/A'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-850 py-1">
                    <span className="text-gray-500 font-sans">Role</span>
                    <span className="text-white font-bold">{profile?.role ?? 'none'}</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-850 py-1">
                    <span className="text-gray-500 font-sans">Is Admin (Effective)</span>
                    <span className="text-white font-bold">
                      {process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' || profile?.role === 'admin' ? 'true' : 'false'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-gray-850 py-1">
                    <span className="text-gray-500 font-sans">MVP Admin Mode</span>
                    <span className={process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' ? 'text-green-400 font-bold' : 'text-gray-500'}>
                      {process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' ? 'ON (Bypassed)' : 'OFF'}
                    </span>
                  </div>
                  <div className="flex justify-between border-b border-gray-850 py-1">
                    <span className="text-gray-500 font-sans">App Version</span>
                    <span className="text-gray-400">v0.1.1</span>
                  </div>
                </div>

                <div className="pt-2 flex gap-2">
                  {(process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true' || profile?.role === 'admin') && (
                    <button
                      onClick={() => {
                        setIsOpen(false)
                        router.push('/admin')
                      }}
                      className="flex-1 bg-gray-800 hover:bg-gray-700 text-white font-semibold py-2 rounded-xl text-xs font-sans text-center transition-colors cursor-pointer"
                    >
                      管理画面
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      await supabase.auth.signOut()
                      setUser(null)
                      setProfile(null)
                      setChurch(null)
                      setIsOpen(false)
                      router.push('/login')
                      router.refresh()
                    }}
                    className="flex-1 bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900/30 font-semibold py-2 rounded-xl text-xs font-sans text-center transition-colors cursor-pointer"
                  >
                    ログアウト
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
