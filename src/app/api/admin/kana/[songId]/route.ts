import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateKana } from '@/lib/openai'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, church_id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return null
  return profile
}

// POST: 韓国語歌詞 → OpenAIでカナルビ生成 → song_materials に保存
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params
  const supabase = await createClient()
  const profile = await requireAdmin(supabase)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 自教会の曲であることを確認
  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('id')
    .eq('id', songId)
    .eq('church_id', profile.church_id)
    .single()
  if (songError || !song) {
    return NextResponse.json({ error: 'Song not found or unauthorized' }, { status: 404 })
  }

  const body = await request.json()
  const { korean_lyrics } = body
  if (!korean_lyrics?.trim()) return NextResponse.json({ error: 'korean_lyrics required' }, { status: 400 })

  const sections = await generateKana(korean_lyrics)

  const { data: existing, error: existingError } = await supabase
    .from('song_materials')
    .select('id')
    .eq('song_id', songId)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  let material
  let saveError
  if (existing) {
    const { data, error } = await supabase
      .from('song_materials')
      .update({
        kanarubi_document: { sections },
        source_lyrics: korean_lyrics
      })
      .eq('id', existing.id)
      .select()
      .single()
    material = data
    saveError = error
  } else {
    const { data, error } = await supabase
      .from('song_materials')
      .insert({
        song_id: songId,
        kanarubi_document: { sections },
        source_lyrics: korean_lyrics
      })
      .select()
      .single()
    material = data
    saveError = error
  }

  if (saveError) {
    return NextResponse.json({ error: saveError.message }, { status: 500 })
  }
  if (!material) {
    return NextResponse.json({ error: 'Failed to save song materials' }, { status: 500 })
  }

  // songs テーブルの公開状態を更新
  const { error: updateError } = await supabase
    .from('songs')
    .update({ is_active: true })
    .eq('id', songId)
    .eq('church_id', profile.church_id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, material })
}

// PUT: カナルビを手動編集
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params
  const supabase = await createClient()
  const profile = await requireAdmin(supabase)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // 自教会の曲であることを確認
  const { data: song, error: songError } = await supabase
    .from('songs')
    .select('id')
    .eq('id', songId)
    .eq('church_id', profile.church_id)
    .single()
  if (songError || !song) {
    return NextResponse.json({ error: 'Song not found or unauthorized' }, { status: 404 })
  }

  try {
    const body = await request.json()
    const { sections: rawSections, source_lyrics } = body

    if (!Array.isArray(rawSections)) {
      return NextResponse.json({ error: 'sections must be an array' }, { status: 400 })
    }

    // 1. バリデーション & フィルタリング
    // 各セクションについて、有効な行のみをトリムして残す
    const cleanedSections = rawSections
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((section: any, index: number) => {
        const cleanedLines = (section.lines || [])
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .map((line: any) => {
            const korean = (line.korean || '').trim()
            const kana = (line.kana || '').trim()
            const translation = (line.translation || '').trim()
            const is_english = !!line.is_english

            return {
              korean: korean || null,
              kana,
              translation: translation || null,
              is_english,
            }
          })
          // すべてが空の行は除外
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .filter((line: any) => line.korean || line.kana || line.translation)

        return {
          ...section,
          order: index + 1, // 連番を再採番
          lines: cleanedLines,
        }
      })
      // 行が空になったセクションを除外
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .filter((section: any) => section.lines.length > 0)

    if (cleanedSections.length === 0) {
      return NextResponse.json({ error: '有効なカナルビ行がありません' }, { status: 400 })
    }

    // 2. 既存レコードの確認
    const { data: existing, error: existingError } = await supabase
      .from('song_materials')
      .select('id')
      .eq('song_id', songId)
      .maybeSingle()

    if (existingError) {
      return NextResponse.json({ error: existingError.message }, { status: 500 })
    }

    let material
    let saveError

    // 更新または挿入データの構築
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const saveData: any = {
      kanarubi_document: { sections: cleanedSections }
    }
    if (source_lyrics !== undefined) {
      saveData.source_lyrics = source_lyrics
    }

    if (existing) {
      const { data, error } = await supabase
        .from('song_materials')
        .update(saveData)
        .eq('id', existing.id)
        .select()
        .single()
      material = data
      saveError = error
    } else {
      const { data, error } = await supabase
        .from('song_materials')
        .insert({
          song_id: songId,
          ...saveData
        })
        .select()
        .single()
      material = data
      saveError = error
    }

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 })
    }
    if (!material) {
      return NextResponse.json({ error: 'Failed to save song materials' }, { status: 500 })
    }

    // songs の公開状態を true に更新・維持
    const { error: updateError } = await supabase
      .from('songs')
      .update({ is_active: true })
      .eq('id', songId)
      .eq('church_id', profile.church_id)

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, material })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
