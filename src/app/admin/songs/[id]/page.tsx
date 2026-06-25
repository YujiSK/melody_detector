'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Song, Kana } from '@/types'

export default function AdminSongPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [song, setSong] = useState<Song | null>(null)
  const [kana, setKana] = useState<Kana | null>(null)
  const [koreanLyrics, setKoreanLyrics] = useState('')
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`/api/songs/${id}`)
      .then(r => r.json())
      .then(d => {
        setSong(d.song)
        setKana(d.kana)
        if (d.kana?.raw_korean) setKoreanLyrics(d.kana.raw_korean)
      })
  }, [id])

  async function generateKana() {
    if (!koreanLyrics.trim()) return
    setGenerating(true)
    setMessage('')
    const res = await fetch(`/api/admin/kana/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ korean_lyrics: koreanLyrics }),
    })
    const data = await res.json()
    setGenerating(false)
    if (!res.ok) { setMessage(`エラー: ${data.error}`); return }
    setKana(data.kana)
    setSong(s => s ? { ...s, status: 'ready' } : s)
    setMessage('カナルビを生成しました')
  }

  async function deleteSong() {
    if (!confirm('本当に削除しますか？')) return
    await fetch(`/api/admin/songs/${id}`, { method: 'DELETE' })
    router.push('/admin')
  }

  if (!song) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="px-4 pt-4 pb-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 p-1">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="text-white font-semibold truncate max-w-[180px]">{song.title}</h1>
        </div>
        <button onClick={deleteSong} className="text-red-400 text-sm hover:text-red-300 transition-colors">
          削除
        </button>
      </header>

      <div className="px-4 py-6 space-y-6 max-w-2xl">
        <div className="bg-gray-900 rounded-xl p-4 space-y-1">
          <p className="text-white font-medium">{song.title}</p>
          {song.title_ja && <p className="text-gray-400 text-sm">{song.title_ja}</p>}
          {song.artist && <p className="text-gray-500 text-xs">{song.artist}</p>}
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1
            ${song.status === 'ready' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
            {song.status === 'ready' ? '公開中' : '準備中'}
          </span>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-white font-medium text-sm">韓国語歌詞</label>
            {kana && (
              <Link href={`/song/${id}`} className="text-blue-400 text-xs hover:text-blue-300">
                カナルビを見る →
              </Link>
            )}
          </div>
          <textarea
            value={koreanLyrics}
            onChange={e => setKoreanLyrics(e.target.value)}
            rows={12}
            placeholder="韓国語歌詞をここに貼り付け…&#10;&#10;[Verse 1]&#10;주님의 영광&#10;..."
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono leading-relaxed"
          />
          {message && (
            <p className={`text-sm ${message.startsWith('エラー') ? 'text-red-400' : 'text-green-400'}`}>
              {message}
            </p>
          )}
          <button
            onClick={generateKana}
            disabled={generating || !koreanLyrics.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            {generating ? 'AIが生成中…' : kana ? 'カナルビを再生成' : 'カナルビを生成（AI）'}
          </button>
        </div>
      </div>
    </div>
  )
}
