'use client'

import { useState, useEffect } from 'react'
import type { SongMaterial, LyricSection } from '@/types'

interface Props {
  material: SongMaterial
  songTitle: string
  songTitleJa?: string | null
}

type FontSize = 'small' | 'standard' | 'large' | 'xlarge'

const STORAGE_KEY = 'melody-detector-font-size'
const SECTION_ORDER = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Instrumental', 'Ending', 'Outro']

// 文字サイズごとのスタイル・マッピング
const sizeClassMap = {
  small: {
    kana: 'text-base',
    translation: 'text-xs',
    korean: 'text-xs',
    heading: 'text-[10px] tracking-wider mb-2',
    spacing: 'space-y-3.5',
    lineSpacing: 'space-y-0.5'
  },
  standard: {
    kana: 'text-xl',
    translation: 'text-sm',
    korean: 'text-sm',
    heading: 'text-xs tracking-widest mb-3',
    spacing: 'space-y-4',
    lineSpacing: 'space-y-0.5'
  },
  large: {
    kana: 'text-3xl md:text-4xl',
    translation: 'text-lg',
    korean: 'text-lg',
    heading: 'text-sm tracking-widest mb-4',
    spacing: 'space-y-6',
    lineSpacing: 'space-y-1.5'
  },
  xlarge: {
    kana: 'text-4xl md:text-5xl',
    translation: 'text-2xl',
    korean: 'text-2xl',
    heading: 'text-base tracking-widest mb-5',
    spacing: 'space-y-8',
    lineSpacing: 'space-y-2'
  }
}

function SectionBlock({ section, fontSize }: { section: LyricSection; fontSize: FontSize }) {
  const classes = sizeClassMap[fontSize]

  return (
    <div className="mb-8">
      {/* セクション見出し */}
      <h3 className={`text-blue-400 font-semibold uppercase tracking-widest ${classes.heading}`}>
        {section.label}
      </h3>
      <div className={classes.spacing}>
        {section.lines.map((line, i) => (
          <div key={i} className={classes.lineSpacing}>
            {/* 韓国語原文（存在する場合のみ表示） */}
            {line.korean && (
              <p className={`text-gray-500 leading-relaxed font-normal ${classes.korean}`}>
                {line.korean}
              </p>
            )}
            {/* カナルビ */}
            <p className={`text-white leading-relaxed font-medium ${classes.kana}`}>
              {line.kana}
            </p>
            {/* 日本語訳 */}
            {line.translation && (
              <p className={`text-gray-400 leading-relaxed ${classes.translation}`}>
                （{line.translation}）
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function KanaDisplay({ material, songTitle, songTitleJa }: Props) {
  const sections = material.kanarubi_document?.sections ?? []
  
  // 初期フォントサイズは standard に設定し hydration エラーを防止
  const [fontSize, setFontSize] = useState<FontSize>('standard')

  // クライアントサイドでのみ localStorage から値を取得する
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'small' || saved === 'standard' || saved === 'large' || saved === 'xlarge') {
        Promise.resolve().then(() => {
          setFontSize(saved)
        })
      }
    } catch (e) {
      console.warn('localStorage is not available:', e)
    }
  }, [])

  const updateFontSize = (size: FontSize) => {
    setFontSize(size)
    try {
      localStorage.setItem(STORAGE_KEY, size)
    } catch (e) {
      console.warn('Failed to save font size to localStorage:', e)
    }
  }

  const sorted = [...sections].sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.type)
    const bi = SECTION_ORDER.indexOf(b.type)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })

  return (
    <div className="max-w-2xl mx-auto px-4 pb-20">
      <div className="py-6 border-b border-gray-800">
        <h1 className="text-white text-2xl font-bold">{songTitle}</h1>
        {songTitleJa && <p className="text-gray-400 text-sm mt-1">{songTitleJa}</p>}
      </div>

      {/* 文字サイズコントロール UI */}
      <div className="flex items-center gap-3 py-3 border-b border-gray-800/80 mb-6 flex-wrap text-sm">
        <span className="text-gray-400 font-medium">文字サイズ:</span>
        <div className="flex bg-gray-900 rounded-lg p-0.5 border border-gray-850" role="group" aria-label="文字サイズ変更">
          {(['small', 'standard', 'large', 'xlarge'] as FontSize[]).map(size => {
            const labels = {
              small: '小',
              standard: '標準',
              large: '大',
              xlarge: '特大'
            }
            const active = fontSize === size
            return (
              <button
                key={size}
                onClick={() => updateFontSize(size)}
                aria-pressed={active}
                aria-label={`文字サイズを${labels[size]}に変更`}
                className={`px-3.5 py-1.5 rounded-md text-xs transition-all duration-200 cursor-pointer ${
                  active
                    ? 'bg-blue-600 text-white font-semibold shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 font-medium'
                }`}
              >
                {labels[size]}
              </button>
            )
          })}
        </div>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          カナルビデータが空であるか、まだ準備できていません。
        </div>
      ) : (
        sorted.map((section, i) => (
          <SectionBlock key={i} section={section} fontSize={fontSize} />
        ))
      )}
    </div>
  )
}
