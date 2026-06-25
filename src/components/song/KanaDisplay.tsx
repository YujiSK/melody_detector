'use client'

import type { Kana, LyricSection } from '@/types'

interface Props {
  kana: Kana
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
      <div className="space-y-3">
        {section.lines.map((line, i) => (
          <div key={i} className="space-y-0.5">
            <p className={`text-white text-xl leading-relaxed font-medium ${line.is_english ? 'font-sans' : ''}`}>
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

export default function KanaDisplay({ kana, songTitle, songTitleJa }: Props) {
  const sorted = [...kana.sections].sort((a, b) => {
    const ai = SECTION_ORDER.indexOf(a.type)
    const bi = SECTION_ORDER.indexOf(b.type)
    return ai - bi
  })

  return (
    <div className="max-w-2xl mx-auto px-4 pb-20">
      <div className="py-6 mb-4 border-b border-gray-800">
        <h1 className="text-white text-2xl font-bold">{songTitle}</h1>
        {songTitleJa && <p className="text-gray-400 text-sm mt-1">{songTitleJa}</p>}
      </div>
      {sorted.map((section, i) => (
        <SectionBlock key={i} section={section} />
      ))}
    </div>
  )
}
