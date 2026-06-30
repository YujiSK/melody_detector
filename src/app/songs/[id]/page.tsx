'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import KanaDisplay from '@/components/song/KanaDisplay'
import { cache } from '@/lib/indexeddb'
import type { Song, SongMaterial } from '@/types'

export default function SongPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [song, setSong] = useState<Song | null>(null)
  const [material, setMaterial] = useState<SongMaterial | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [isOfflineCache, setIsOfflineCache] = useState(false)
  const [isFavorite, setIsFavorite] = useState(false)

  // 初期ロード時のお気に入り状態取得
  useEffect(() => {
    async function checkFav() {
      try {
        const fav = await cache.isFavoriteSong(id)
        setIsFavorite(fav)
      } catch (e) {
        console.warn('Failed to read favorite status:', e)
      }
    }
    checkFav()
  }, [id])

  useEffect(() => {
    async function load() {
      // キャッシュ優先表示
      const cachedSong = await cache.getSong(id)
      const cachedMaterial = await cache.getSongMaterial(id)
      if (cachedSong && cachedMaterial) {
        setSong(cachedSong)
        setMaterial(cachedMaterial)
        setIsOfflineCache(true)
        setLoading(false)
        // キャッシュからロード時も履歴を記録
        try {
          await cache.addRecent(id)
        } catch (e) {
          console.warn('Failed to add to history:', e)
        }
      }

      try {
        const res = await fetch(`/api/songs/${id}`)
        if (!res.ok) {
          if (!cachedSong) setError('曲が見つかりませんでした')
          setLoading(false)
          return
        }
        const data = await res.json()
        setSong(data.song)
        setMaterial(data.material)
        setIsOfflineCache(false) // ネットワークから取得できた場合はキャッシュ表示フラグをオフ

        // ローカルキャッシュ同期
        await cache.putSong(data.song)
        if (data.material) await cache.putSongMaterial(data.material)
        await cache.addRecent(id)
      } catch (err) {
        // ネットワークエラーでキャッシュがある場合はエラーにせずキャッシュのままで続行
        if (!cachedSong) {
          setError('ネットワークエラーが発生しました')
        } else {
          setIsOfflineCache(true)
        }
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const toggleFavorite = async () => {
    if (!song) return
    try {
      if (isFavorite) {
        await cache.removeFavoriteSong(song.id)
        setIsFavorite(false)
      } else {
        await cache.addFavoriteSong(song)
        setIsFavorite(true)
      }
    } catch (e) {
      console.warn('Failed to toggle favorite:', e)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !song) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-gray-400">{error || '曲が見つかりませんでした'}</p>
        <button onClick={() => router.back()} className="text-blue-400 text-sm">戻る</button>
      </div>
    )
  }

  const sections = material?.kanarubi_document?.sections ?? []
  if (!material || sections.length === 0) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-white text-lg font-bold">{song.title_ko}</p>
        {song.title_ja && <p className="text-gray-400 text-sm">{song.title_ja}</p>}
        {song.artist && <p className="text-gray-500 text-xs">{song.artist}</p>}
        <p className="text-gray-400 text-sm">カナルビ資料はまだ登録されていません</p>
        <div className="flex flex-col gap-2 items-center mt-2">
          <a
            href={`/admin/songs/${id}`}
            className="text-blue-400 text-sm hover:text-blue-300 underline"
          >
            管理画面で編集する →
          </a>
          <button onClick={() => router.back()} className="text-gray-500 text-xs mt-1 cursor-pointer">戻る</button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* オフライン表示インジケーター */}
      {isOfflineCache && (
        <div className="bg-yellow-900/30 text-yellow-500 border-b border-yellow-800/40 text-center py-1.5 text-[10px] font-medium tracking-wide">
          オフラインキャッシュから表示しています
        </div>
      )}

      <header className="sticky top-0 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center justify-between gap-3 z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => router.back()} className="text-gray-400 p-1 shrink-0 cursor-pointer" aria-label="戻る">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <span className="text-white font-medium text-sm truncate">{song.title_ko}</span>
        </div>

        {/* お気に入りトグルボタン */}
        <button
          onClick={toggleFavorite}
          aria-pressed={isFavorite}
          aria-label={isFavorite ? 'お気に入り解除' : 'お気に入りに追加'}
          className="p-1.5 rounded-lg text-gray-400 hover:text-white transition-all duration-200 cursor-pointer shrink-0"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill={isFavorite ? '#eab308' : 'none'}
            stroke={isFavorite ? '#eab308' : 'currentColor'}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-200 active:scale-125"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      </header>
      <KanaDisplay material={material} songTitle={song.title_ko} songTitleJa={song.title_ja} />
    </div>
  )
}
