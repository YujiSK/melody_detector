'use client'

import type { SongMaterial, LyricSection } from '@/types'

interface Props {
  material: SongMaterial
  songTitle: string
  songTitleJa?: string | null
}

const SECTION_ORDER = ['Intro', 'Verse', 'Pre-Chorus', 'Chorus', 'Bridge', 'Instrumental', 'Ending', 'Outro']

function SectionBlock({ section }: { section: LyricSection }) {
  return (
    <div className="mb-8">
      <h3 className="text-blue-400 text-xs font-semibold uppercase tracking-widest mb-3">
        {section.label}
      </h3>
      <div className="space-y-4">
        {section.lines.map((line, i) => (
          <div key={i} className="space-y-0.5">
            <p className="text-white text-xl leading-relaxed font-medium">
              {line.kana}
            </p>
            {line.translation && (
              <p className="text-gray-400 text-sm leading-relaxed">
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
      <div className="py-6 mb-4 border-b border-gray-800">
        <h1 className="text-white text-2xl font-bold">{songTitle}</h1>
        {songTitleJa && <p className="text-gray-400 text-sm mt-1">{songTitleJa}</p>}
      </div>
      {sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-sm">
          カナルビデータが空であるか、まだ準備できていません。
        </div>
      ) : (
        sorted.map((section, i) => (
          <SectionBlock key={i} section={section} />
        ))
      )}
    </div>
  )
}
