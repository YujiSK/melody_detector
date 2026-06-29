import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { generateKana } from '@/lib/openai'

async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { profile: null, reason: 'No authenticated user session found' }
  }

  const adminSupabase = await createAdminClient()

  try {
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
        if (churchErr) throw new Error(`Auto-Setup (church creation failed): ${churchErr.message}`)
        if (newChurch) churchId = newChurch.id
      }

      if (!churchId) {
        throw new Error('Auto-Setup (church ID could not be resolved)')
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

      if (profileErr) throw new Error(`Auto-Setup (profile creation failed): ${profileErr.message}`)
      if (newProfile) {
        profile = newProfile
      } else {
        throw new Error('Auto-Setup (profile creation returned empty data)')
      }

      const { error: memberErr } = await adminSupabase
        .from('church_members')
        .insert({
          church_id: churchId,
          user_id: user.id,
          role: 'admin',
        })
      if (memberErr) throw new Error(`Auto-Setup (membership mapping failed): ${memberErr.message}`)
    }

    if (profile && !profile.church_id) {
      let churchId = ''
      const { data: existingChurches } = await adminSupabase.from('churches').select('id').limit(1)
      if (existingChurches && existingChurches.length > 0) {
        churchId = existingChurches[0].id
      } else {
        const { data: newChurch, error: churchErr } = await adminSupabase.from('churches').insert({ name: 'Default Church' }).select('id').single()
        if (churchErr) throw new Error(`Auto-Setup (fallback church creation failed): ${churchErr.message}`)
        if (newChurch) churchId = newChurch.id
      }
      
      if (churchId) {
        const { data: updatedProfile, error: updateErr } = await adminSupabase
          .from('profiles')
          .update({ church_id: churchId })
          .eq('id', user.id)
          .select('id, church_id, role')
          .single()
        if (updateErr) throw new Error(`Auto-Setup (profile update failed): ${updateErr.message}`)
        if (updatedProfile) {
          profile = updatedProfile
        }
      }
    }

    if (!disableAuth && profile.role !== 'admin') {
      return { profile: null, reason: `User role is not admin (actual role: ${profile.role})` }
    }

    return { profile, reason: null }

  } catch (err) {
    const error = err as Error
    return { profile: null, reason: error.message || 'Database exception during admin validation' }
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const check = await requireAdmin(supabase)
  if (!check.profile) {
    return NextResponse.json({
      error: 'Forbidden',
      reason: check.reason
    }, { status: 403 })
  }

  try {
    const body = await request.json()
    const { korean_lyrics } = body
    if (!korean_lyrics?.trim()) {
      return NextResponse.json({ error: 'korean_lyrics required' }, { status: 400 })
    }

    const sections = await generateKana(korean_lyrics)
    return NextResponse.json({ sections })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
