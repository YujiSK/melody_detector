'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Song, SongMaterial } from '@/types'

export default function AdminSongPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [song, setSong] = useState<Song | null>(null)
  const [material, setMaterial] = useState<SongMaterial | null>(null)
  const [koreanLyrics, setKoreanLyrics] = useState('')
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch(`/api/songs/${id}`)
      .then(r => r.json())
      .then(d => {
        setSong(d.song)
        setMaterial(d.material)
        if (d.material?.source_lyrics) setKoreanLyrics(d.material.source_lyrics)
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
    setMaterial(data.material)
    setSong(s => s ? { ...s, is_active: true } : s)
    setMessage('カナルビを生成しました')
  }

  async function deleteSong() {
    if (!confirm('本当に削除しますか？この操作は取り消せません。')) return
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
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin" className="text-gray-400 p-1 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="text-white font-semibold truncate">{song.title_ko}</h1>
        </div>
        <button onClick={deleteSong} className="text-red-400 text-sm hover:text-red-300 transition-colors shrink-0 ml-3">
          削除
        </button>
      </header>

      <div className="px-4 py-6 space-y-6 max-w-2xl">
        {/* 曲情報 */}
        <div className="bg-gray-900 rounded-xl p-4 space-y-1">
          <p className="text-white font-medium">{song.title_ko}</p>
          {song.title_ja && <p className="text-gray-400 text-sm">{song.title_ja}</p>}
          {song.artist && <p className="text-gray-500 text-xs">{song.artist}</p>}
          {song.acrcloud_music_id && (
            <p className="text-gray-600 text-xs font-mono mt-1">ACR: {song.acrcloud_music_id.slice(0, 16)}…</p>
          )}
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1
            ${song.is_active ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
            {song.is_active ? '公開中' : '準備中'}
          </span>
        </div>

        {/* 韓国語歌詞入力・カナルビ生成 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-white font-medium text-sm">韓国語歌詞</label>
            {material && (
              <Link href={`/song/${id}`} className="text-blue-400 text-xs hover:text-blue-300">
                カナルビを見る →
              </Link>
            )}
          </div>
          <textarea
            value={koreanLyrics}
            onChange={e => setKoreanLyrics(e.target.value)}
            rows={14}
            placeholder={`韓国語歌詞をここに貼り付け…\n\n[Verse 1]\n주님의 영광\n...\n\n[Chorus]\n할렐루야\n...`}
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
            {generating
              ? 'AIが生成中…'
              : material
                ? 'カナルビを再生成（AI）'
                : 'カナルビを生成（AI）'}
          </button>
          {material && (
            <p className="text-gray-600 text-xs text-center">
              最終更新: {new Date(material.updated_at).toLocaleString('ja-JP')}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
