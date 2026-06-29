import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const adminSupabase = await createAdminClient()

  // 1. Try to fetch profile
  let { data: profile } = await adminSupabase
    .from('profiles')
    .select('id, church_id, role')
    .eq('id', user.id)
    .single()

  const disableAuth = process.env.NEXT_PUBLIC_DISABLE_AUTH === 'true'

  // 2. If profile is missing, automatically provision default church and admin role
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

    // 2-c. Register as church member (role = admin)
    await adminSupabase
      .from('church_members')
      .insert({
        church_id: churchId,
        user_id: user.id,
        role: 'admin',
      })
  }

  // 3. Fallback: if church_id is missing on the profile
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

export async function GET() {
  const supabase = await createClient()
  const profile = await requireAdmin(supabase)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Query using adminSupabase (RLS bypassed) to guarantee access
  const adminSupabase = await createAdminClient()
  const { data, error } = await adminSupabase
    .from('songs')
    .select('*')
    .eq('church_id', profile.church_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ songs: data })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const profile = await requireAdmin(supabase)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { title, title_ja, artist, acrcloud_music_id } = body
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  // Insert using adminSupabase (RLS bypassed) to bypass insert errors
  const adminSupabase = await createAdminClient()
  const { data, error } = await adminSupabase
    .from('songs')
    .insert({ church_id: profile.church_id, title, title_ja, artist, acrcloud_music_id, status: 'pending' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ song: data }, { status: 201 })
}
