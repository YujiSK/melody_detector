'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewSongPage() {
  const router = useRouter()
  const [form, setForm] = useState({ title_ko: '', title_ja: '', artist: '', acrcloud_music_id: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function update(key: keyof typeof form, val: string) {
    setForm(f => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title_ko) return
    setLoading(true)
    setError('')

    const res = await fetch('/api/admin/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { setError(data.error); return }
    router.push(`/admin/songs/${data.song.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="px-4 pt-4 pb-3 border-b border-gray-800 flex items-center gap-3">
        <Link href="/admin" className="text-gray-400 p-1">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </Link>
        <h1 className="text-white font-semibold">曲を追加</h1>
      </header>

      <form onSubmit={handleSubmit} className="px-4 py-6 space-y-4 max-w-lg">
        <div>
          <label className="text-gray-400 text-xs mb-1 block">曲名（韓国語・英語）*</label>
          <input
            required
            value={form.title_ko}
            onChange={e => update('title_ko', e.target.value)}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 주님의 영광"
          />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">曲名（日本語）</label>
          <input
            value={form.title_ja}
            onChange={e => update('title_ja', e.target.value)}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 主の栄光"
          />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">アーティスト名</label>
          <input
            value={form.artist}
            onChange={e => update('artist', e.target.value)}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="例: 어노인팅"
          />
        </div>
        <div>
          <label className="text-gray-400 text-xs mb-1 block">ACRCloud Music ID（音声認識紐付け用）</label>
          <input
            value={form.acrcloud_music_id}
            onChange={e => update('acrcloud_music_id', e.target.value)}
            className="w-full bg-gray-800 text-white rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs"
            placeholder="ACRCloudが返すacrid値"
          />
          <p className="text-gray-600 text-xs mt-1">音声認識後に自動設定されます。手動入力も可能です。</p>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || !form.title_ko}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
        >
          {loading ? '保存中…' : '保存して歌詞登録へ'}
        </button>
      </form>
    </div>
  )
}
