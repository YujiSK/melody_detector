import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateKana } from '@/lib/openai'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { profile: null, reason: 'No authenticated user session found', churchId: null }
  }

  const adminSupabase = await createAdminClient()

  try {
    let { data: profile } = await adminSupabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', user.id)
      .single()

    let { data: member } = await adminSupabase
      .from('church_members')
      .select('church_id, role')
      .eq('user_id', user.id)
      .single()

    const disableAuth = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'

    if (!profile || !member) {
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
        if (churchErr) throw new Error(`Auto-Setup (church creation failed): ${churchErr.message}`)
        if (newChurch) churchId = newChurch.id
      }

      if (!churchId) {
        throw new Error('Auto-Setup (church ID could not be resolved)')
      }

      if (!profile) {
        const displayName = user.email?.split('@')[0] || 'User'
        const { data: newProfile, error: profileErr } = await adminSupabase
          .from('profiles')
          .insert({
            id: user.id,
            display_name: displayName,
          })
          .select('id, display_name')
          .single()

        if (profileErr) throw new Error(`Auto-Setup (profile creation failed): ${profileErr.message}`)
        if (newProfile) {
          profile = newProfile
        }
      }

      if (!member) {
        const { data: newMember, error: memberErr } = await adminSupabase
          .from('church_members')
          .insert({
            church_id: churchId,
            user_id: user.id,
            role: 'admin',
          })
          .select('church_id, role')
          .single()
        if (memberErr) throw new Error(`Auto-Setup (membership mapping failed): ${memberErr.message}`)
        if (newMember) member = newMember
      }
    }

    if (!member) {
      throw new Error('Auto-Setup failed to resolve membership')
    }

    if (!disableAuth && member.role !== 'admin') {
      return { profile: null, reason: `User role is not admin (actual role: ${member.role})`, churchId: null }
    }

    return { profile, reason: null, churchId: member.church_id }

  } catch (err) {
    const error = err as Error
    return { profile: null, reason: error.message || 'Database exception during admin validation', churchId: null }
  }
}

// POST: 韓国語歌詞 → OpenAIでカナルビ生成 → song_materials に保存
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params
  const supabase = await createClient()
  const check = await requireAdmin(supabase)
  if (!check.profile || !check.churchId) {
    return NextResponse.json({
      error: 'Forbidden',
      reason: check.reason
    }, { status: 403 })
  }
  const churchId = check.churchId

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
      .insert({ song_id: songId, church_id: churchId, sections, raw_korean: korean_lyrics })
      .select()
      .single()
    material = data
  }

  await adminSupabase
    .from('songs')
    .update({ status: 'ready' })
    .eq('id', songId)
    .eq('church_id', churchId)

  return NextResponse.json({ material })
}

// PUT: カナルビを手動編集
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  const { songId } = await params
  const supabase = await createClient()
  const check = await requireAdmin(supabase)
  if (!check.profile || !check.churchId) {
    return NextResponse.json({
      error: 'Forbidden',
      reason: check.reason
    }, { status: 403 })
  }
  const churchId = check.churchId

  const body = await request.json()
  const { sections } = body

  const adminSupabase = await createAdminClient()
  const { data, error } = await adminSupabase
    .from('song_materials')
    .update({ sections })
    .eq('song_id', songId)
    .eq('church_id', churchId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ material: data })
}
