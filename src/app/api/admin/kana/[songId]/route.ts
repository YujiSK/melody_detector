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

  const body = await request.json()
  const { sections } = body

  const { data, error } = await supabase
    .from('song_materials')
    .update({ kanarubi_document: { sections } })
    .eq('song_id', songId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, material: data })
}
