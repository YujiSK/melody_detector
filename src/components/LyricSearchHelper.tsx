'use client'

import React from 'react'

interface LyricSearchHelperProps {
  title?: string | null
  artist?: string | null
}

export default function LyricSearchHelper({ title, artist }: LyricSearchHelperProps) {
  if (!title) return null

  // 検索クエリの作成
  const query = artist ? `${title} ${artist}` : title
  const encodedQuery = encodeURIComponent(query)
  const encodedGasaQuery = encodeURIComponent(`${query} 가사`)
  const encodedLyricsQuery = encodeURIComponent(`${query} lyrics`)

  // 各種リンクの定義
  const links = [
    { name: 'Bugsで探す', url: `https://music.bugs.co.kr/search/integrated?q=${encodedQuery}` },
    { name: 'Melonで探す', url: `https://www.melon.com/search/total/index.htm?q=${encodedQuery}` },
    { name: 'Genieで探す', url: `https://www.genie.co.kr/search/searchMain?query=${encodedQuery}` },
    { name: 'Google 가사', url: `https://www.google.com/search?q=${encodedGasaQuery}` },
    { name: 'Google lyrics', url: `https://www.google.com/search?q=${encodedLyricsQuery}` },
    { name: 'YouTube', url: `https://www.youtube.com/results?search_query=${encodedQuery}` }
  ]

  return (
    <div className="w-full bg-gray-950 rounded-xl p-4 text-left text-xs space-y-3 border border-gray-800/50">
      <p className="text-gray-400 font-medium text-[11px] uppercase tracking-wider">歌詞を探す</p>
      <div className="grid grid-cols-2 gap-2">
        {links.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center bg-gray-900 hover:bg-gray-800 active:scale-95 text-blue-400 hover:text-blue-300 font-medium py-2.5 px-3 rounded-lg border border-gray-800 transition-all text-center text-xs"
          >
            {link.name}
          </a>
        ))}
      </div>
    </div>
  )
}
