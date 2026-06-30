'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Song, SongMaterial, LyricSection, LyricLine } from '@/types'
import { cache } from '@/lib/indexeddb'

// ハングル歌詞（source_lyrics）を改行分割して LyricLine.korean に安全にマッピングする関数
function mapSourceLyricsToSections(sections: LyricSection[], sourceLyrics: string | null): LyricSection[] {
  if (!sourceLyrics) return sections

  // 改行で分割し、トリム。空行および「[Verse]」などの見出し行を除外
  const sourceLines = sourceLyrics
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith('['))

  const totalLines = sections.flatMap(s => s.lines)

  // 安全なマッピング：歌詞の総行数が完全に一致する場合のみ自動マッピングする
  if (sourceLines.length === totalLines.length) {
    let lineIndex = 0
    return sections.map(section => ({
      ...section,
      lines: section.lines.map(line => {
        const korean = sourceLines[lineIndex]
        lineIndex++
        return {
          ...line,
          korean: korean || null
        }
      })
    }))
  }

  // 一致しない場合は、korean を空欄で初期化
  return sections.map(section => ({
    ...section,
    lines: section.lines.map(line => ({
      ...line,
      korean: line.korean || null
    }))
  }))
}

export default function AdminSongPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [song, setSong] = useState<Song | null>(null)
  const [material, setMaterial] = useState<SongMaterial | null>(null)
  const [koreanLyrics, setKoreanLyrics] = useState('')
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState('')

  // 手動編集用 state
  const [editableSections, setEditableSections] = useState<LyricSection[]>([])
  const [isSavingManualEdit, setIsSavingManualEdit] = useState(false)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [manualEditMessage, setManualEditMessage] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/songs/${id}`)
      .then(r => r.json())
      .then(d => {
        setSong(d.song)
        setMaterial(d.material)
        if (d.material?.source_lyrics) setKoreanLyrics(d.material.source_lyrics)
        if (d.material?.kanarubi_document?.sections) {
          const mapped = mapSourceLyricsToSections(
            d.material.kanarubi_document.sections,
            d.material.source_lyrics
          )
          setEditableSections(mapped)
        }
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

    // AI生成成功時に editableSections を同期
    if (data.material?.kanarubi_document?.sections) {
      const mapped = mapSourceLyricsToSections(
        data.material.kanarubi_document.sections,
        data.material.source_lyrics
      )
      setEditableSections(mapped)
      setHasUnsavedChanges(false)
    }
  }

  // 手動編集の保存処理
  async function saveManualEdit() {
    setIsSavingManualEdit(true)
    setManualEditMessage(null)
    try {
      const res = await fetch(`/api/admin/kana/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sections: editableSections,
          source_lyrics: koreanLyrics
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setManualEditMessage(`エラー: ${data.error || '保存に失敗しました'}`)
        return
      }

      setMaterial(data.material)
      
      if (data.material?.kanarubi_document?.sections) {
        const mapped = mapSourceLyricsToSections(
          data.material.kanarubi_document.sections,
          data.material.source_lyrics
        )
        setEditableSections(mapped)
      }
      setHasUnsavedChanges(false)
      setManualEditMessage('手動編集内容を保存しました')

      // IndexedDBキャッシュの更新
      await cache.putSongMaterial(data.material)

      setTimeout(() => setManualEditMessage(null), 3000)
    } catch (err) {
      setManualEditMessage(`エラー: ${String(err)}`)
    } finally {
      setIsSavingManualEdit(false)
    }
  }

  // 手動編集のリセット
  function resetManualEdit() {
    if (!confirm('変更を破棄して元のデータに戻しますか？')) return
    if (material?.kanarubi_document?.sections) {
      const mapped = mapSourceLyricsToSections(
        material.kanarubi_document.sections,
        material.source_lyrics
      )
      setEditableSections(mapped)
      setHasUnsavedChanges(false)
      setManualEditMessage(null)
    }
  }

  // セクション名/種類の変更
  function handleSectionChange(secIndex: number, field: keyof LyricSection, value: string) {
    setEditableSections(prev => {
      const copy = [...prev]
      copy[secIndex] = { ...copy[secIndex], [field]: value }
      return copy
    })
    setHasUnsavedChanges(true)
  }

  // 歌詞行のテキスト変更
  function handleLineChange(secIndex: number, lineIndex: number, field: keyof LyricLine, value: string | boolean) {
    setEditableSections(prev => {
      const copy = [...prev]
      const lines = [...copy[secIndex].lines]
      lines[lineIndex] = { ...lines[lineIndex], [field]: value }
      copy[secIndex] = { ...copy[secIndex], lines }
      return copy
    })
    setHasUnsavedChanges(true)
  }

  // 歌詞行の追加
  function addLine(secIndex: number) {
    setEditableSections(prev => {
      const copy = [...prev]
      const lines = [...copy[secIndex].lines]
      lines.push({
        korean: '',
        kana: '',
        translation: '',
        is_english: false
      })
      copy[secIndex] = { ...copy[secIndex], lines }
      return copy
    })
    setHasUnsavedChanges(true)
  }

  // 歌詞行の削除
  function deleteLine(secIndex: number, lineIndex: number) {
    if (!confirm('この行を削除しますか？')) return
    setEditableSections(prev => {
      const copy = [...prev]
      const lines = copy[secIndex].lines.filter((_, i) => i !== lineIndex)
      copy[secIndex] = { ...copy[secIndex], lines }
      return copy
    })
    setHasUnsavedChanges(true)
  }

  // 歌詞行の順序移動
  function moveLine(secIndex: number, lineIndex: number, direction: 'up' | 'down') {
    setEditableSections(prev => {
      const copy = [...prev]
      const lines = [...copy[secIndex].lines]
      const targetIdx = direction === 'up' ? lineIndex - 1 : lineIndex + 1
      if (targetIdx < 0 || targetIdx >= lines.length) return prev

      const temp = lines[lineIndex]
      lines[lineIndex] = lines[targetIdx]
      lines[targetIdx] = temp

      copy[secIndex] = { ...copy[secIndex], lines }
      return copy
    })
    setHasUnsavedChanges(true)
  }

  // セクション自体の追加
  function addSection() {
    setEditableSections(prev => [
      ...prev,
      {
        type: 'Verse',
        label: `Verse ${prev.length + 1}`,
        lines: [
          { korean: '', kana: '', translation: '', is_english: false }
        ]
      }
    ])
    setHasUnsavedChanges(true)
  }

  // セクションの削除
  function deleteSection(secIndex: number) {
    if (!confirm('このセクション全体を削除しますか？内の歌詞行もすべて削除されます。')) return
    setEditableSections(prev => prev.filter((_, i) => i !== secIndex))
    setHasUnsavedChanges(true)
  }

  // セクションの順序移動
  function moveSection(secIndex: number, direction: 'up' | 'down') {
    const targetIdx = direction === 'up' ? secIndex - 1 : secIndex + 1
    if (targetIdx < 0 || targetIdx >= editableSections.length) return
    setEditableSections(prev => {
      const copy = [...prev]
      const temp = copy[secIndex]
      copy[secIndex] = copy[targetIdx]
      copy[targetIdx] = temp
      return copy
    })
    setHasUnsavedChanges(true)
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

      <div className="px-4 py-6 space-y-6 max-w-2xl mx-auto">
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
              <Link href={`/songs/${id}`} className="text-blue-400 text-xs hover:text-blue-300">
                一般画面でカナルビを見る →
              </Link>
            )}
          </div>
          <textarea
            value={koreanLyrics}
            onChange={e => {
              setKoreanLyrics(e.target.value)
              setHasUnsavedChanges(true)
            }}
            rows={10}
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

        {/* 手動編集UI */}
        <div className="space-y-4 pt-4 border-t border-gray-800">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-semibold text-base">カナルビ手動編集</h2>
            {hasUnsavedChanges && (
              <span className="bg-yellow-900/50 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-medium">
                未保存の変更があります
              </span>
            )}
          </div>

          {!material ? (
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6 text-center text-gray-500 text-sm">
              まだカナルビが生成されていません。先に上の「カナルビを生成」を実行してください。
            </div>
          ) : (
            <div className="space-y-6">
              {/* 操作ボタン（上部） */}
              <div className="flex gap-2">
                <button
                  onClick={saveManualEdit}
                  disabled={isSavingManualEdit || !hasUnsavedChanges}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  {isSavingManualEdit ? '保存中...' : '変更を保存'}
                </button>
                <button
                  onClick={resetManualEdit}
                  disabled={isSavingManualEdit || !hasUnsavedChanges}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  リセット
                </button>
              </div>

              {manualEditMessage && (
                <p className={`text-sm text-center ${manualEditMessage.startsWith('エラー') ? 'text-red-400' : 'text-green-400'}`}>
                  {manualEditMessage}
                </p>
              )}

              {/* セクションカードリスト */}
              <div className="space-y-4">
                {editableSections.map((section, secIdx) => (
                  <div key={secIdx} className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-4">
                    {/* セクションヘッダー */}
                    <div className="flex items-center justify-between gap-2 border-b border-gray-800 pb-3 flex-wrap">
                      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
                        <select
                          value={section.type}
                          onChange={e => handleSectionChange(secIdx, 'type', e.target.value as LyricSection['type'])}
                          className="bg-gray-800 text-white text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
                        >
                          {['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Instrumental', 'Ending', 'Outro'].map(t => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={section.label}
                          onChange={e => handleSectionChange(secIdx, 'label', e.target.value)}
                          className="bg-gray-800 text-white text-xs font-semibold rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-500 flex-1"
                          placeholder="セクション名 (例: Verse 1)"
                        />
                      </div>

                      {/* セクション操作ボタン */}
                      <div className="flex items-center gap-1.5">
                        <button
                          disabled={secIdx === 0}
                          onClick={() => moveSection(secIdx, 'up')}
                          className="text-gray-400 hover:text-white disabled:opacity-20 text-xs p-1 cursor-pointer"
                          title="セクションを上へ"
                        >
                          ▲
                        </button>
                        <button
                          disabled={secIdx === editableSections.length - 1}
                          onClick={() => moveSection(secIdx, 'down')}
                          className="text-gray-400 hover:text-white disabled:opacity-20 text-xs p-1 cursor-pointer"
                          title="セクションを下へ"
                        >
                          ▼
                        </button>
                        <button
                          onClick={() => deleteSection(secIdx)}
                          className="text-red-400 hover:text-red-300 text-xs p-1 cursor-pointer"
                          title="セクション削除"
                        >
                          削除
                        </button>
                      </div>
                    </div>

                    {/* 歌詞行リスト */}
                    <div className="space-y-4">
                      {section.lines.map((line, lineIdx) => (
                        <div key={lineIdx} className="bg-gray-950 border border-gray-800 rounded-lg p-3 space-y-2.5 relative">
                          {/* 行番号と行操作ボタン */}
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-gray-500 font-mono">#{lineIdx + 1}</span>
                            <div className="flex items-center gap-1">
                              <button
                                disabled={lineIdx === 0}
                                onClick={() => moveLine(secIdx, lineIdx, 'up')}
                                className="text-gray-400 hover:text-white disabled:opacity-20 text-xs px-1 cursor-pointer"
                                title="上へ移動"
                              >
                                ↑
                              </button>
                              <button
                                disabled={lineIdx === section.lines.length - 1}
                                onClick={() => moveLine(secIdx, lineIdx, 'down')}
                                className="text-gray-400 hover:text-white disabled:opacity-20 text-xs px-1 cursor-pointer"
                                title="下へ移動"
                              >
                                ↓
                              </button>
                              <button
                                onClick={() => deleteLine(secIdx, lineIdx)}
                                className="text-red-400 hover:text-red-300 text-xs px-1 cursor-pointer"
                                title="行を削除"
                              >
                                ✕
                              </button>
                            </div>
                          </div>

                          {/* 行テキスト入力項目 */}
                          <div className="space-y-2 text-xs">
                            <div>
                              <label className="text-gray-500 block mb-0.5">韓国語原文</label>
                              <textarea
                                value={line.korean || ''}
                                onChange={e => handleLineChange(secIdx, lineIdx, 'korean', e.target.value)}
                                rows={1}
                                placeholder="例: 우리들을 위하여"
                                className="w-full bg-gray-900 text-white rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-gray-500 block mb-0.5">カナルビ</label>
                              <textarea
                                value={line.kana}
                                onChange={e => handleLineChange(secIdx, lineIdx, 'kana', e.target.value)}
                                rows={1}
                                placeholder="例: ウリドゥルル ウィハヨ"
                                className="w-full bg-gray-900 text-white rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 resize-none font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-gray-500 block mb-0.5">日本語訳</label>
                              <textarea
                                value={line.translation || ''}
                                onChange={e => handleLineChange(secIdx, lineIdx, 'translation', e.target.value)}
                                rows={1}
                                placeholder="例: 私たちのために"
                                className="w-full bg-gray-900 text-white rounded px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* 歌詞行の追加ボタン */}
                    <button
                      onClick={() => addLine(secIdx)}
                      className="w-full border border-dashed border-gray-800 hover:border-gray-700 text-gray-500 hover:text-gray-400 py-2 rounded-lg text-xs transition-colors cursor-pointer"
                    >
                      + 歌詞行を追加
                    </button>
                  </div>
                ))}
              </div>

              {/* セクション追加ボタン */}
              <button
                onClick={addSection}
                className="w-full border border-dashed border-gray-850 hover:border-gray-800 text-gray-400 hover:text-white py-3 rounded-xl text-xs transition-all cursor-pointer"
              >
                + 新しいセクションを追加
              </button>

              {/* 操作ボタン（下部） */}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={saveManualEdit}
                  disabled={isSavingManualEdit || !hasUnsavedChanges}
                  className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-30 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  {isSavingManualEdit ? '保存中...' : '変更を保存'}
                </button>
                <button
                  onClick={resetManualEdit}
                  disabled={isSavingManualEdit || !hasUnsavedChanges}
                  className="bg-gray-800 hover:bg-gray-700 disabled:opacity-30 text-white px-4 py-2.5 rounded-xl text-sm transition-colors cursor-pointer"
                >
                  リセット
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
