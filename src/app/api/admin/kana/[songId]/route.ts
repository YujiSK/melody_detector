import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateKana } from '@/lib/openai'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('church_id, role')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role !== 'admin') return null
  return profile
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params
  const supabase = await createClient()
  const profile = await requireAdmin(supabase)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { korean_lyrics } = body
  if (!korean_lyrics) return NextResponse.json({ error: 'korean_lyrics required' }, { status: 400 })

  const sections = await generateKana(korean_lyrics)

  const { data: existing } = await supabase
    .from('kana')
    .select('id')
    .eq('song_id', songId)
    .single()

  let kana
  if (existing) {
    const { data } = await supabase
      .from('kana')
      .update({ sections, raw_korean: korean_lyrics })
      .eq('id', existing.id)
      .select()
      .single()
    kana = data
  } else {
    const { data } = await supabase
      .from('kana')
      .insert({ song_id: songId, church_id: profile.church_id, sections, raw_korean: korean_lyrics })
      .select()
      .single()
    kana = data
  }

  await supabase
    .from('songs')
    .update({ status: 'ready' })
    .eq('id', songId)
    .eq('church_id', profile.church_id)

  return NextResponse.json({ kana })
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params
  const supabase = await createClient()
  const profile = await requireAdmin(supabase)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { sections } = body

  const { data, error } = await supabase
    .from('kana')
    .update({ sections })
    .eq('song_id', songId)
    .eq('church_id', profile.church_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ kana: data })
}
