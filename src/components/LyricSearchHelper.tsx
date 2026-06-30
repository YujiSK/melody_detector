'use client'

import React, { useState } from 'react'

interface LyricSearchHelperProps {
  title?: string | null // 既存呼び出し元との後方互換用
  titleKo?: string | null
  titleJa?: string | null
  artist?: string | null
  textareaId?: string // 歌詞入力 textarea の DOM ID
}

export default function LyricSearchHelper({
  title,
  titleKo,
  titleJa,
  artist,
  textareaId
}: LyricSearchHelperProps) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null)

  const resolvedTitle = titleKo || title || titleJa || ''
  const artistName = artist || ''

  // 最低限タイトルがない場合はエラー案内
  if (!resolvedTitle.trim()) {
    return (
      <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-center text-gray-500 text-xs">
        曲名が未設定のため、検索リンクを作成できません。
      </div>
    )
  }

  // 検索語候補
  const queryCandidates = [
    { text: [resolvedTitle, artistName, '가사'].filter(Boolean).join(' '), label: '韓国語 (曲名 + 歌手)' },
    { text: [resolvedTitle, '가사'].filter(Boolean).join(' '), label: '韓国語 (曲名のみ)' },
    { text: [resolvedTitle, artistName, 'lyrics'].filter(Boolean).join(' '), label: '英語 (曲名 + 歌手)' }
  ]

  // コピー機能
  const handleCopy = async (text: string, index: number) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(text)
        setCopiedIndex(index)
        setTimeout(() => setCopiedIndex(null), 2000)
      } else {
        // フォールバック
        const temp = document.createElement('textarea')
        temp.value = text
        document.body.appendChild(temp)
        temp.select()
        document.execCommand('copy')
        document.body.removeChild(temp)
        setCopiedIndex(index)
        setTimeout(() => setCopiedIndex(null), 2000)
      }
    } catch (err) {
      console.error(err)
      alert('コピーできませんでした。手動でコピーしてください。')
    }
  }

  // 歌詞入力エリアへのフォーカス・スクロール移動
  const handleFocusTextarea = () => {
    if (textareaId) {
      const el = document.getElementById(textareaId)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.focus()
      }
    }
  }

  // 代表クエリとして「曲名 + 歌手 + 가사」を基準に使用
  const baseQuery = queryCandidates[0].text
  const englishQuery = queryCandidates[2].text

  // 外部リンク
  const searchLinks = [
    { name: 'Bugsで探す ↗', url: `https://music.bugs.co.kr/search/integrated?q=${encodeURIComponent(baseQuery)}` },
    { name: 'Melonで探す ↗', url: `https://www.melon.com/search/total/index.htm?q=${encodeURIComponent(baseQuery)}` },
    { name: 'Genieで探す ↗', url: `https://www.genie.co.kr/search/searchMain?query=${encodeURIComponent(baseQuery)}` },
    { name: 'Google 가사 ↗', url: `https://www.google.com/search?q=${encodeURIComponent(baseQuery)}` },
    { name: 'Google lyrics ↗', url: `https://www.google.com/search?q=${encodeURIComponent(englishQuery)}` },
    { name: 'YouTube ↗', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(baseQuery)}` }
  ]

  return (
    <div className="w-full bg-gray-900 border border-gray-800 rounded-xl p-4 text-left space-y-4">
      <div>
        <p className="text-blue-400 font-semibold text-xs uppercase tracking-wider mb-1">韓国語歌詞検索</p>
        <p className="text-gray-400 text-xs">
          外部サイトで歌詞を確認し、韓国語歌詞だけを下の入力欄に貼り付けてください。
        </p>
      </div>

      {/* 検索語コピーセクション */}
      <div className="space-y-2">
        <span className="text-gray-500 text-[10px] uppercase font-semibold block tracking-wider">
          検索語コピー:
        </span>
        <div className="space-y-2">
          {queryCandidates.map((q, idx) => (
            <div key={idx} className="flex items-center justify-between bg-gray-950 border border-gray-850 rounded-lg p-2 gap-2 text-xs">
              <div className="min-w-0 flex-1">
                <span className="text-[10px] text-gray-500 block mb-0.5">{q.label}</span>
                <span className="text-white font-mono truncate block">{q.text}</span>
              </div>
              <button
                onClick={() => handleCopy(q.text, idx)}
                className={`shrink-0 text-xs px-3 py-1.5 rounded font-medium transition-all cursor-pointer ${
                  copiedIndex === idx
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-850 hover:bg-gray-800 text-gray-300 hover:text-white'
                }`}
              >
                {copiedIndex === idx ? 'コピー完了' : 'コピー'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 外部リンクボタンセクション */}
      <div className="space-y-2">
        <span className="text-gray-500 text-[10px] uppercase font-semibold block tracking-wider">
          外部サイト検索リンク:
        </span>
        <div className="grid grid-cols-2 gap-2">
          {searchLinks.map(link => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center bg-gray-950 hover:bg-gray-850 active:scale-95 text-blue-400 hover:text-blue-300 font-medium py-2.5 px-3 rounded-lg border border-gray-800/80 transition-all text-center text-xs"
            >
              {link.name}
            </a>
          ))}
        </div>
      </div>

      {/* 貼り付け誘導とフォーカス移動ボタン */}
      {textareaId && (
        <button
          onClick={handleFocusTextarea}
          className="w-full bg-gray-800 hover:bg-gray-700 active:scale-98 text-white font-semibold py-2.5 rounded-xl text-xs transition-all cursor-pointer text-center"
        >
          ↓ 歌詞入力欄へ移動して貼り付け
        </button>
      )}
    </div>
  )
}
