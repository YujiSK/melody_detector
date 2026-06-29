import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateKana } from '@/lib/openai'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminSupabase = await createAdminClient()

  let { data: profile } = await adminSupabase
    .from('profiles')
    .select('id, church_id, role')
    .eq('id', user.id)
    .single()

  const disableAuth = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'

  if (!profile) {
    let churchId = ''
    const { data: existingChurches } = await adminSupabase
      .from('churches')
      .select('id')
      .limit(1)
    
    if (existingChurches && existingChurches.length > 0) {
      churchId = existingChurches[0].id
    } else {
      const { data: newChurch, error: churchErr } = await adminSupabase
        .from('churches')
        .insert({ name: 'Default Church' })
        .select('id')
        .single()
      if (newChurch) {
        churchId = newChurch.id
      } else {
        console.error('Failed to create default church:', churchErr)
        return null
      }
    }

    const displayName = user.email?.split('@')[0] || 'User'
    const { data: newProfile, error: profileErr } = await adminSupabase
      .from('profiles')
      .insert({
        id: user.id,
        church_id: churchId,
        role: 'admin',
        display_name: displayName,
      })
      .select('id, church_id, role')
      .single()

    if (newProfile) {
      profile = newProfile
    } else {
      console.error('Failed to create user profile:', profileErr)
      return null
    }

    await adminSupabase
      .from('church_members')
      .insert({
        church_id: churchId,
        user_id: user.id,
        role: 'admin',
      })
  }

  if (profile && !profile.church_id) {
    let churchId = ''
    const { data: existingChurches } = await adminSupabase.from('churches').select('id').limit(1)
    if (existingChurches && existingChurches.length > 0) {
      churchId = existingChurches[0].id
    } else {
      const { data: newChurch } = await adminSupabase.from('churches').insert({ name: 'Default Church' }).select('id').single()
      if (newChurch) churchId = newChurch.id
    }
    
    if (churchId) {
      const { data: updatedProfile } = await adminSupabase
        .from('profiles')
        .update({ church_id: churchId })
        .eq('id', user.id)
        .select('id, church_id, role')
        .single()
      if (updatedProfile) {
        profile = updatedProfile
      }
    }
  }

  if (!disableAuth && profile.role !== 'admin') return null
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

  const body = await request.json()
  const { korean_lyrics } = body
  if (!korean_lyrics?.trim()) return NextResponse.json({ error: 'korean_lyrics required' }, { status: 400 })

  const sections = await generateKana(korean_lyrics)

  const adminSupabase = await createAdminClient()
  const { data: existing } = await adminSupabase
    .from('song_materials')
    .select('id')
    .eq('song_id', songId)
    .single()

  let material
  if (existing) {
    const { data } = await adminSupabase
      .from('song_materials')
      .update({ sections, raw_korean: korean_lyrics })
      .eq('id', existing.id)
      .select()
      .single()
    material = data
  } else {
    const { data } = await adminSupabase
      .from('song_materials')
      .insert({ song_id: songId, church_id: profile.church_id, sections, raw_korean: korean_lyrics })
      .select()
      .single()
    material = data
  }

  await adminSupabase
    .from('songs')
    .update({ status: 'ready' })
    .eq('id', songId)
    .eq('church_id', profile.church_id)

  return NextResponse.json({ material })
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

  const body = await request.json()
  const { sections } = body

  const adminSupabase = await createAdminClient()
  const { data, error } = await adminSupabase
    .from('song_materials')
    .update({ sections })
    .eq('song_id', songId)
    .eq('church_id', profile.church_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ material: data })
}
