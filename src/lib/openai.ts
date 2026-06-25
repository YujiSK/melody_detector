import OpenAI from 'openai'
import type { LyricSection } from '@/types'

let client: OpenAI | null = null
function getClient() {
  if (!client) client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return client
}

const SYSTEM_PROMPT = `あなたは韓国語賛美歌のカナルビ生成の専門家です。
韓国語の歌詞を日本人礼拝者向けに変換してください。

ルール:
- 韓国語原文は出力しない
- カナルビ（カタカナ読み）と日本語訳のみ出力
- 英語部分はそのまま英語で残し訳を付ける
- 繰り返し指示（×2, ×4等）は省略記号で表す
- セクションはIntro/Verse/Pre-Chorus/Chorus/Bridge/Instrumental/Ending/Outroで整理
- 日本語訳は礼拝向けの自然な日本語
- 神学用語（주님→主/하나님→神/예수님→イエス様）を統一

JSON形式で出力:
{
  "sections": [
    {
      "type": "Verse",
      "label": "Verse 1",
      "lines": [
        { "kana": "カナルビ", "translation": "日本語訳", "is_english": false }
      ]
    }
  ]
}`

export async function generateKana(koreanLyrics: string): Promise<LyricSection[]> {
  const response = await getClient().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `以下の韓国語歌詞を変換してください:\n\n${koreanLyrics}` },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  })

  const content = response.choices[0].message.content
  if (!content) throw new Error('Empty response from OpenAI')

  const parsed = JSON.parse(content)
  return parsed.sections as LyricSection[]
}
