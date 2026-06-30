import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function GET(_request: NextRequest) {
  const supabase = await createClient()
  const profile = await requireAdmin(supabase)
  if (!profile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
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
  const { title_ko, title, title_ja, artist, acrcloud_music_id, acrcloud_external_id } = body
  
  const finalTitleKo = title_ko || title
  if (!finalTitleKo) return NextResponse.json({ error: 'title_ko required' }, { status: 400 })

  const { data, error } = await supabase
    .from('songs')
    .insert({
      church_id: profile.church_id,
      title_ko: finalTitleKo,
      title_ja: title_ja || null,
      artist: artist || null,
      acrcloud_music_id: acrcloud_music_id || null,
      acrcloud_external_id: acrcloud_external_id || null,
      is_active: false,
      created_by: profile.id
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ song: data }, { status: 201 })
}
