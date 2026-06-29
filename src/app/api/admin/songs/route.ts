import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

export async function GET() {
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
  const { title, title_ja, artist, acrcloud_music_id } = body
  if (!title) return NextResponse.json({ error: 'Title required' }, { status: 400 })

  const { data, error } = await supabase
    .from('songs')
    .insert({ church_id: profile.church_id, title, title_ja, artist, acrcloud_music_id, status: 'pending' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ song: data }, { status: 201 })
}
