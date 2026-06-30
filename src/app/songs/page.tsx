'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/layout/BottomNav'
import { cache } from '@/lib/indexeddb'
import type { Song, FavoriteSong, RecentSong } from '@/types'

function SongItem({ song }: { song: Song }) {
  return (
    <Link
      href={`/songs/${song.id}`}
      className="flex items-center gap-3 px-4 py-3.5 hover:bg-gray-800/40 transition-colors"
    >
      <div className="w-10 h-10 bg-gray-900 border border-gray-800 rounded-lg flex items-center justify-center shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-white text-sm font-medium truncate">{song.title_ko}</p>
        {song.title_ja && <p className="text-gray-400 text-xs truncate mt-0.5">{song.title_ja}</p>}
        {song.artist && <p className="text-gray-500 text-xs truncate mt-0.5">{song.artist}</p>}
      </div>
    </Link>
  )
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(false)
  const [favoriteSongs, setFavoriteSongs] = useState<FavoriteSong[]>([])
  const [recentSongs, setRecentSongs] = useState<RecentSong[]>([])
  const router = useRouter()

  const loadLocalData = useCallback(async () => {
    try {
      const favs = await cache.getFavoriteSongs()
      const recents = await cache.getRecents()
      setFavoriteSongs(favs)
      setRecentSongs(recents.slice(0, 10)) // 表示は最大10件に制限
    } catch (e) {
      console.warn('Failed to load local history/favorites:', e)
    }
  }, [])

  const search = useCallback(async (q: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/songs?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSongs(data.songs || [])
    } catch {
      setSongs([])
    } finally {
      setLoading(false)
    }
  }, [])

  // お気に入り解除処理 (リスト上)
  const handleRemoveFavorite = async (e: React.MouseEvent, songId: string) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await cache.removeFavoriteSong(songId)
      await loadLocalData()
    } catch (err) {
      console.warn('Failed to remove favorite:', err)
    }
  }

  // 履歴個別削除処理
  const handleRemoveRecent = async (e: React.MouseEvent, songId: string) => {
    e.preventDefault()
    e.stopPropagation()
    try {
      await cache.removeRecentSong(songId)
      await loadLocalData()
    } catch (err) {
      console.warn('Failed to remove recent history:', err)
    }
  }

  // 履歴一括削除処理
  const handleClearAllRecents = async () => {
    if (confirm('閲覧履歴をすべて削除しますか？')) {
      try {
        await cache.clearRecentSongs()
        await loadLocalData()
      } catch (err) {
        console.warn('Failed to clear recents:', err)
      }
    }
  }

  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query, search])

  useEffect(() => {
    Promise.resolve().then(() => {
      search('')
      loadLocalData()
    })
  }, [search, loadLocalData])

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 p-1 cursor-pointer" aria-label="戻る">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl flex items-center px-3 gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 shrink-0">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            autoFocus
            type="search"
            placeholder="曲名・日本語訳で検索"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-white py-3 text-sm outline-none placeholder-gray-500"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto pb-24">
        {/* 未検索時のみ「お気に入り」と「履歴」を表示 */}
        {query === '' && (
          <div className="space-y-6 px-4 py-2 mb-4">
            {/* お気に入りセクション */}
            <div>
              <h2 className="text-white font-semibold text-xs uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#eab308" stroke="#eab308">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
                お気に入り
              </h2>
              {favoriteSongs.length === 0 ? (
                <div className="text-gray-500 text-xs py-3.5 bg-gray-900/30 border border-gray-800/40 rounded-xl text-center">
                  お気に入りの曲はまだありません。
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-850 rounded-xl divide-y divide-gray-800/50 overflow-hidden">
                  {favoriteSongs.map(fav => (
                    <Link
                      key={fav.song_id}
                      href={`/songs/${fav.song_id}`}
                      className="flex items-center justify-between p-3.5 hover:bg-gray-800/40 transition-colors"
                    >
                      <div className="min-w-0 pr-3 flex-1">
                        <span className="text-white text-sm font-medium truncate block">{fav.title_ko}</span>
                        {fav.artist && <span className="text-gray-500 text-xs truncate block mt-0.5">{fav.artist}</span>}
                      </div>
                      <button
                        onClick={(e) => handleRemoveFavorite(e, fav.song_id)}
                        className="text-gray-400 hover:text-red-400 transition-colors px-2 py-1 text-xs shrink-0 cursor-pointer font-medium"
                        aria-label="お気に入り解除"
                      >
                        解除
                      </button>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 履歴セクション */}
            <div>
              <div className="flex items-center justify-between mb-2.5">
                <h2 className="text-white font-semibold text-xs uppercase tracking-wider flex items-center gap-1.5">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                  最近見た曲
                </h2>
                {recentSongs.length > 0 && (
                  <button
                    onClick={handleClearAllRecents}
                    className="text-gray-500 hover:text-gray-300 text-[10px] uppercase font-semibold transition-colors cursor-pointer"
                  >
                    すべて削除
                  </button>
                )}
              </div>
              {recentSongs.length === 0 ? (
                <div className="text-gray-500 text-xs py-3.5 bg-gray-900/30 border border-gray-800/40 rounded-xl text-center">
                  最近見た曲はありません。
                </div>
              ) : (
                <div className="bg-gray-900 border border-gray-850 rounded-xl divide-y divide-gray-800/50 overflow-hidden">
                  {recentSongs.map(rec => (
                    <Link
                      key={rec.song_id}
                      href={`/songs/${rec.song_id}`}
                      className="flex items-center justify-between p-3.5 hover:bg-gray-800/40 transition-colors"
                    >
                      <div className="min-w-0 pr-3 flex-1">
                        <span className="text-white text-sm font-medium truncate block">{rec.title_ko}</span>
                        {rec.artist && <span className="text-gray-500 text-xs truncate block mt-0.5">{rec.artist}</span>}
                      </div>
                      <button
                        onClick={(e) => handleRemoveRecent(e, rec.song_id)}
                        className="text-gray-500 hover:text-red-400 transition-colors p-1.5 shrink-0 cursor-pointer"
                        aria-label="履歴から削除"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* 全ての曲ヘッダー */}
            {songs.length > 0 && (
              <h2 className="text-white font-semibold text-xs uppercase tracking-wider border-t border-gray-850 pt-5 mt-4">
                すべての登録曲
              </h2>
            )}
          </div>
        )}

        {/* 検索結果（または全登録曲） */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm px-4">
            {query ? '曲が見つかりませんでした' : '曲がまだ登録されていません'}
          </div>
        ) : (
          <div className="divide-y divide-gray-800/50">
            {songs.map(song => <SongItem key={song.id} song={song} />)}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
