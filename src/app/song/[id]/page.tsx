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

  useEffect(() => {
    async function load() {
      // キャッシュ優先表示
      const cachedSong = await cache.getSong(id)
      const cachedMaterial = await cache.getSongMaterial(id)
      if (cachedSong && cachedMaterial) {
        setSong(cachedSong)
        setMaterial(cachedMaterial)
        setLoading(false)
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
        await cache.putSong(data.song)
        if (data.material) await cache.putSongMaterial(data.material)
        await cache.addRecent(id)
      } catch {
        if (!cachedSong) setError('ネットワークエラーが発生しました')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

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

  if (!material) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 px-4">
        <p className="text-white text-lg font-bold">{song.title_ko}</p>
        <p className="text-gray-400 text-sm">カナルビ資料はまだ登録されていません</p>
        <button onClick={() => router.back()} className="text-blue-400 text-sm mt-2">戻る</button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="sticky top-0 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 p-1 shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="text-white font-medium text-sm truncate">{song.title_ko}</span>
      </header>
      <KanaDisplay material={material} songTitle={song.title_ko} songTitleJa={song.title_ja} />
    </div>
  )
}
