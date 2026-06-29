import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET: 疎通確認用
export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "setup initial api alive"
  })
}

// POST: 初期セットアップ処理の実行
export async function POST() {
  const debugLogs: string[] = []
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({
        error: 'Forbidden',
        reason: 'No authenticated user session found'
      }, { status: 403 })
    }

    const adminSupabase = await createAdminClient()
    debugLogs.push(`Auth user detected: ${user.id} (${user.email})`)

    // 1. Churches lookup or creation
    let churchId = ''
    debugLogs.push('Checking existing churches...')
    const { data: existingChurches, error: churchFindErr } = await adminSupabase
      .from('churches')
      .select('id')
      .limit(1)

    if (churchFindErr) {
      debugLogs.push(`Error searching churches: ${churchFindErr.message}`)
    }

    if (existingChurches && existingChurches.length > 0) {
      churchId = existingChurches[0].id
      debugLogs.push(`Found existing church: ${churchId}`)
    } else {
      debugLogs.push('No church found. Inserting Default Church...')
      const { data: newChurch, error: churchInsertErr } = await adminSupabase
        .from('churches')
        .insert({ name: 'Default Church' })
        .select('id')
        .single()
      
      if (churchInsertErr) {
        throw new Error(`Failed to create default church: ${churchInsertErr.message}`)
      }
      if (newChurch) {
        churchId = newChurch.id
        debugLogs.push(`Created default church: ${churchId}`)
      }
    }

    if (!churchId) {
      throw new Error('Church ID could not be resolved')
    }

    // 2. Profiles lookup or creation (profiles: id, display_nameのみ)
    debugLogs.push('Checking user profile...')
    const { data: existingProfile, error: profileFindErr } = await adminSupabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', user.id)
      .single()

    if (profileFindErr && profileFindErr.code !== 'PGRST116') {
      debugLogs.push(`Error checking profile: ${profileFindErr.message}`)
    }

    let profile = existingProfile

    if (!profile) {
      debugLogs.push('Profile not found. Creating profile...')
      const displayName = user.email?.split('@')[0] || 'User'
      
      const { data: newProfile, error: profileInsertErr } = await adminSupabase
        .from('profiles')
        .insert({
          id: user.id,
          display_name: displayName,
        })
        .select('id, display_name')
        .single()

      if (profileInsertErr) {
        throw new Error(`Failed to create profile: ${profileInsertErr.message}`)
      }
      if (newProfile) {
        profile = newProfile
        debugLogs.push('Profile created successfully')
      }
    } else {
      debugLogs.push(`Profile exists: display_name=${profile.display_name}`)
    }

    // 3. Church Members lookup or creation (church_members: church_id, user_id, role)
    debugLogs.push('Checking church membership...')
    const { data: existingMember, error: memberFindErr } = await adminSupabase
      .from('church_members')
      .select('id, church_id, role')
      .eq('user_id', user.id)
      .single()

    if (memberFindErr && memberFindErr.code !== 'PGRST116') {
      debugLogs.push(`Error checking membership: ${memberFindErr.message}`)
    }

    let member = existingMember

    if (!member) {
      debugLogs.push('Membership not found. Registering user as church admin member...')
      const { data: newMember, error: memberInsertErr } = await adminSupabase
        .from('church_members')
        .insert({
          church_id: churchId,
          user_id: user.id,
          role: 'admin',
        })
        .select('id, church_id, role')
        .single()

      if (memberInsertErr) {
        throw new Error(`Failed to insert church membership: ${memberInsertErr.message}`)
      }
      member = newMember
      debugLogs.push('Church membership registered successfully')
    } else {
      debugLogs.push(`Membership exists: role=${member.role}, church_id=${member.church_id}`)
      if (member.role !== 'admin' || member.church_id !== churchId) {
        debugLogs.push('Updating membership to admin / linking default church...')
        const { data: updated, error: updateErr } = await adminSupabase
          .from('church_members')
          .update({ role: 'admin', church_id: churchId })
          .eq('id', member.id)
          .select('id, church_id, role')
          .single()
        if (updateErr) {
          throw new Error(`Failed to update membership: ${updateErr.message}`)
        }
        if (updated) {
          member = updated
          debugLogs.push('Membership updated successfully')
        }
      }
    }

    return NextResponse.json({
      ok: true,
      message: 'Initial setup completed successfully',
      logs: debugLogs,
      profile,
      member
    })

  } catch (err) {
    const error = err as Error
    return NextResponse.json({
      ok: false,
      error: 'Setup failed',
      reason: error.message,
      logs: debugLogs,
      debug: {
        hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
        serviceRoleKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY ? process.env.SUPABASE_SERVICE_ROLE_KEY.length : 0,
        envKeys: Object.keys(process.env).filter(k => k.includes('SUPABASE')),
      }
    }, { status: 500 })
  }
}
