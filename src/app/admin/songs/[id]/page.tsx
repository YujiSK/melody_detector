'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Song, SongMaterial } from '@/types'
import LyricSearchHelper from '@/components/LyricSearchHelper'

export default function AdminSongPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [song, setSong] = useState<Song | null>(null)
  const [material, setMaterial] = useState<SongMaterial | null>(null)
  const [koreanLyrics, setKoreanLyrics] = useState('')
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/songs/${id}`)
      .then(async r => {
        if (!r.ok) {
          const errData = await r.json().catch(() => ({}))
          throw new Error(errData.error || `HTTP ${r.status}`)
        }
        return r.json()
      })
      .then(d => {
        setSong(d.song)
        setMaterial(d.material)
        if (d.material?.raw_korean) setKoreanLyrics(d.material.raw_korean)
      })
      .catch(e => {
        setError(e.message || String(e))
      })
      .finally(() => {
        setLoading(false)
      })
  }, [id])

  async function generateKana() {
    if (!koreanLyrics.trim()) return
    setGenerating(true)
    setMessage('')
    try {
      const res = await fetch(`/api/admin/kana/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ korean_lyrics: koreanLyrics }),
      })
      const data = await res.json()
      setGenerating(false)
      if (!res.ok) {
        setMessage(`エラー: ${data.error || 'カナルビ生成に失敗しました'}`)
        return
      }
      setMaterial(data.material)
      setSong(s => s ? { ...s, status: 'ready' } : s)
      setMessage('カナルビを生成しました')

      // プレビュー表示位置までスムーススクロール
      setTimeout(() => {
        const previewEl = document.getElementById('preview-section')
        if (previewEl) {
          previewEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 150)

    } catch (e) {
      setGenerating(false)
      setMessage(`エラー: ${String(e)}`)
    }
  }

  async function deleteSong() {
    if (!confirm('本当に削除しますか？この操作は取り消せません。')) return
    await fetch(`/api/admin/songs/${id}`, { method: 'DELETE' })
    router.push('/admin')
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (error || !song) return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 space-y-4 text-center">
      <p className="text-red-400 font-semibold text-sm">エラー: {error || '曲データを取得できませんでした'}</p>
      <Link href="/admin" className="text-blue-400 text-xs hover:underline">
        管理画面一覧へ戻る
      </Link>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 pb-16">
      <header className="px-4 pt-4 pb-3 border-b border-gray-800 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link href="/admin" className="text-gray-400 p-1 shrink-0">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </Link>
          <h1 className="text-white font-semibold truncate">{song.title}</h1>
        </div>
        <button onClick={deleteSong} className="text-red-400 text-sm hover:text-red-300 transition-colors shrink-0 ml-3">
          削除
        </button>
      </header>

      <div className="px-4 py-6 space-y-8 max-w-2xl mx-auto">
        {/* 上部：曲情報カード */}
        <div className="bg-gray-900 rounded-xl p-4 space-y-1 border border-gray-800">
          <p className="text-white font-medium">{song.title}</p>
          {song.title_ja && <p className="text-gray-400 text-sm">{song.title_ja}</p>}
          {song.artist && <p className="text-gray-500 text-xs">{song.artist}</p>}
          {song.acrcloud_music_id && (
            <p className="text-gray-600 text-xs font-mono mt-1">ACR: {song.acrcloud_music_id.slice(0, 16)}…</p>
          )}
          <span className={`inline-block text-xs px-2 py-0.5 rounded-full mt-1
            ${material ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
            {material ? '公開中' : '準備中'}
          </span>
        </div>

        {/* 中部：韓国語歌詞入力 & カナルビ生成 */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-white font-medium text-sm">韓国語歌詞</label>
            {material && (
              <Link href={`/songs/${id}`} className="text-blue-400 text-xs hover:text-blue-300">
                公開ページを見る →
              </Link>
            )}
          </div>
          
          <LyricSearchHelper title={song.title_ko || song.title} artist={song.artist} />

          <textarea
            value={koreanLyrics}
            onChange={e => setKoreanLyrics(e.target.value)}
            rows={10}
            placeholder={`韓国語歌詞をここに貼り付け…\n\n[Verse 1]\n주님의 영광\n...\n\n[Chorus]\n할렐루야\n...`}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono leading-relaxed h-[240px] max-h-[280px]"
          />
          
          {message && (
            <p className={`text-sm font-medium ${message.startsWith('エラー') ? 'text-red-400' : 'text-green-400'}`}>
              {message}
            </p>
          )}
          
          <button
            onClick={generateKana}
            disabled={generating || !koreanLyrics.trim()}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all active:scale-95 text-sm"
          >
            {generating
              ? '生成中...'
              : material
                ? 'カナルビを再生成（AI）'
                : 'カナルビを生成（AI）'}
          </button>
        </div>

        {/* 下部：生成結果プレビュー */}
        {material && material.sections && material.sections.length > 0 && (
          <div id="preview-section" className="bg-gray-900 rounded-xl p-5 border border-gray-800 space-y-4 transition-all duration-300">
            <div className="flex items-center justify-between border-b border-gray-800 pb-3">
              <h2 className="text-white font-semibold text-sm flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                生成結果プレビュー (礼拝用)
              </h2>
              <Link
                href={`/songs/${id}`}
                className="bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs px-3.5 py-2 rounded-lg transition-all active:scale-95"
              >
                公開ページで確認
              </Link>
            </div>

            <div className="space-y-6 max-h-[450px] overflow-y-auto pr-1 text-sm leading-relaxed font-sans text-white">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {material.sections.map((section: any, sIdx: number) => (
                <div key={sIdx} className="space-y-2">
                  <h4 className="text-blue-400 font-bold text-xs uppercase tracking-wider bg-blue-950/40 px-2.5 py-1 rounded inline-block">
                    {section.label || section.type}
                  </h4>
                  <div className="space-y-3.5 pl-1">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {section.lines && section.lines.map((line: any, lIdx: number) => (
                      <div key={lIdx} className="space-y-0.5">
                        <p className="text-white font-semibold text-[15px] leading-snug tracking-wide select-all">
                          {line.kana}
                        </p>
                        {line.translation && (
                          <p className="text-gray-400 text-xs font-light">
                            {line.translation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <p className="text-gray-600 text-[10px] text-center pt-2 border-t border-gray-800">
              最終更新: {new Date(material.updated_at).toLocaleString('ja-JP')}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
