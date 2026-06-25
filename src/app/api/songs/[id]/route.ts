import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('church_id')
    .eq('id', user.id)
    .single()
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

  const { data: song } = await supabase
    .from('songs')
    .select('*')
    .eq('id', id)
    .eq('church_id', profile.church_id)
    .single()
  if (!song) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: material } = await supabase
    .from('song_materials')
    .select('*')
    .eq('song_id', id)
    .single()

  // 閲覧履歴更新
  await supabase.from('user_song_activity').upsert({
    user_id: user.id,
    song_id: id,
    last_viewed_at: new Date().toISOString(),
    view_count: 1,
  }, { onConflict: 'user_id,song_id', ignoreDuplicates: false })

  return NextResponse.json({ song, material })
}
