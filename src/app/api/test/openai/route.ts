import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export async function GET() {
  const apiKey = process.env.OPENAI_API_KEY

  if (!apiKey || apiKey.startsWith('sk-your')) {
    return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY not configured' }, { status: 500 })
  }

  try {
    const client = new OpenAI({ apiKey })
    const response = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: '「안녕하세요」をカタカナに変換してください。JSON形式で { "kana": "..." } だけ返してください。' }],
      response_format: { type: 'json_object' },
      max_tokens: 50,
    })

    const content = response.choices[0].message.content
    const parsed = content ? JSON.parse(content) : null

    return NextResponse.json({
      ok: true,
      model: response.model,
      result: parsed,
      usage: response.usage,
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
