import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import OpenAI from 'openai'

const MAX_IMAGE_DATA_URL_LENGTH = 1_500_000 // 圧縮後の想定容量上限 (約1.5MB)
const OCR_MODEL = process.env.OPENAI_OCR_MODEL || 'gpt-4o-mini'

const OCR_PROMPT = `
あなたは韓国語賛美歌詞のOCR専門家です。

画像から韓国語の歌詞本文だけを抽出してください。

ルール:
- ハングルの歌詞本文だけを出力してください。
- 日本語訳、英語訳、曲情報、作詞作曲者、著作権表記、ページ番号、コード譜、UI文字、不要な記号は除外してください。
- 歌詞の自然な改行を保ってください。
- 読み取れない文字は無理に補完せず、文脈上明らかな場合のみ自然に補ってください。
- セクション名が画像内に明確にある場合のみ [Verse], [Chorus], [Bridge] のように残して構いません。
- 出力はプレーンテキストのみ。
- 説明、前置き、箇条書き、Markdownコードブロックは出力しないでください。
`

export async function POST(request: NextRequest) {
  // 1. 認証と権限の確認
  const supabase = await createClient()
  
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile, error: dbError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (dbError || !profile || profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 2. リクエストボディのバリデーション
  try {
    const body = await request.json()
    const { image } = body

    if (!image || typeof image !== 'string') {
      return NextResponse.json({ error: '画像データが見つかりません。' }, { status: 400 })
    }

    // 容量上限チェック
    if (image.length > MAX_IMAGE_DATA_URL_LENGTH) {
      return NextResponse.json({ error: '画像ファイルのサイズが大きすぎます。' }, { status: 413 })
    }

    // プレフィックスおよび MIME バリデーション
    const matches = image.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,/)
    if (!matches) {
      return NextResponse.json({ error: '不正な画像データ形式です。' }, { status: 400 })
    }

    const mimeType = matches[1]
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
      return NextResponse.json({ error: '対応していない画像形式です。JPG, PNG, WebPのみ対応しています。' }, { status: 400 })
    }

    const base64Data = image.split(',')[1]
    if (!base64Data || base64Data.trim() === '') {
      return NextResponse.json({ error: '画像データの抽出に失敗しました。' }, { status: 400 })
    }

    // 3. OpenAI Vision API 呼び出し
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI APIキーがサーバー側で設定されていません。' }, { status: 500 })
    }

    const openai = new OpenAI({ apiKey })

    // Chat Completions で画像を入力する標準形式を使用
    const completion = await openai.chat.completions.create({
      model: OCR_MODEL,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: OCR_PROMPT
            },
            {
              type: 'image_url',
              image_url: {
                url: image
              }
            }
          ]
        }
      ],
      temperature: 0.2
    })

    const text = completion.choices[0]?.message?.content
    if (!text || text.trim() === '') {
      return NextResponse.json({
        error: '韓国語歌詞を読み取れませんでした。画像を明るく、正面から撮影して再試行してください。'
      }, { status: 422 })
    }

    return NextResponse.json({ text: text.trim() })

  } catch (err) {
    // 安全方針に従い、画像データやOCR結果全文をログ出力しない
    const errMsg = err instanceof Error ? err.message : String(err)
    console.error('OCR processing error occurred:', errMsg)
    return NextResponse.json({ error: 'OCR処理中にサーバーエラーが発生しました。' }, { status: 500 })
  }
}
