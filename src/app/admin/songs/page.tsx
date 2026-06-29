import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

interface SongMaterialStub {
  id: string
  kanarubi_document: unknown
}

interface SongWithMaterials {
  id: string
  title_ko: string | null
  title_ja: string | null
  artist: string | null
  created_at: string
  song_materials?: SongMaterialStub[]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseJsonSafe(val: any) {
  if (typeof val === 'string') {
    try {
      return JSON.parse(val)
    } catch {
      return []
    }
  }
  return val || []
}

export default async function AdminSongsListPage() {
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

  // song_materials の kanarubi_document 存在有無を JOIN して取得
  const { data: songsRaw } = await supabase
    .from('songs')
    .select('id, title_ko, title_ja, artist, created_at, song_materials(id, kanarubi_document)')
    .eq('church_id', profile.church_id)
    .order('created_at', { ascending: false })

  const songs = (songsRaw || []) as unknown as SongWithMaterials[]

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="px-4 pt-4 pb-3 border-b border-gray-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="text-white font-semibold">曲管理</h1>
        </div>
        <Link
          href="/admin/songs/new"
          className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          + 曲追加
        </Link>
      </header>

      <main className="px-4 py-4 max-w-2xl mx-auto">
        <div className="space-y-2">
          {!songs.length && (
            <p className="text-gray-500 text-sm text-center py-8">曲がまだ登録されていません</p>
          )}
          {songs.map(song => {
            const materials = song.song_materials || []
            const parsedDoc = materials.length > 0 ? parseJsonSafe(materials[0].kanarubi_document) : []
            const hasMaterial = Array.isArray(parsedDoc) && parsedDoc.length > 0
            const displayTitle = song.title_ko || 'No Title'

            return (
              <Link
                key={song.id}
                href={`/admin/songs/${song.id}`}
                className="flex items-center gap-3 bg-gray-900 rounded-xl px-4 py-3 hover:bg-gray-800 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{displayTitle}</p>
                  {song.title_ja && <p className="text-gray-400 text-xs truncate">{song.title_ja}</p>}
                  {song.artist && <p className="text-gray-500 text-xs truncate">{song.artist}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full shrink-0
                  ${hasMaterial
                    ? 'bg-green-900/50 text-green-400'
                    : 'bg-yellow-900/50 text-yellow-400'
                  }`}
                >
                  {hasMaterial ? '公開中' : '準備中'}
                </span>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
