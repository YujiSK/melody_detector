'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import BottomNav from '@/components/layout/BottomNav'
import type { Song } from '@/types'

function SongItem({ song }: { song: Song }) {
  return (
    <Link
      href={`/song/${song.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-800/50 transition-colors"
    >
      <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
          <path d="M9 18V5l12-2v13" />
          <circle cx="6" cy="18" r="3" />
          <circle cx="18" cy="16" r="3" />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-white text-sm font-medium truncate">{song.title_ko}</p>
        {song.title_ja && <p className="text-gray-400 text-xs truncate">{song.title_ja}</p>}
        {song.artist && <p className="text-gray-500 text-xs truncate">{song.artist}</p>}
      </div>
    </Link>
  )
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(false)
  const router = useRouter()

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

  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query, search])

  useEffect(() => {
    Promise.resolve().then(() => search(''))
  }, [search])

  return (
    <div className="flex flex-col min-h-screen bg-gray-950">
      <header className="px-4 pt-4 pb-3 flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-400 p-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <div className="flex-1 bg-gray-800 rounded-xl flex items-center px-3 gap-2">
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
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : songs.length === 0 ? (
          <div className="text-center py-12 text-gray-500 text-sm">
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
